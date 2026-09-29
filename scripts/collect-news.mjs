import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = join(root, "data");
const logDir = join(dataDir, "logs");

const skipOnFail = process.argv.includes("--skip-on-fail");

const AI_PATTERN =
  /AI|AIGC|GPT|LLM|大模型|人工智能|智能体|生成式|机器学习|深度学习|ChatGPT|Claude|Gemini|DeepSeek|通义|豆包|文心|多模态|Agent/i;

const SCENE_RULES = [
  { id: "writing", pattern: /写作|文案|翻译|内容|稿|文章|提示词|Prompt/i },
  { id: "image", pattern: /绘图|绘画|生图|图像|图片|设计|Midjourney|文生图/i },
  { id: "video", pattern: /视频|剪辑|数字人|短剧|影视|文生视频/i },
  { id: "coding", pattern: /编程|代码|开发|开源|模型权重|API|SDK|GitHub/i },
  { id: "office", pattern: /办公|文档|表格|会议|效率|搜索/i },
];

const parser = new Parser({
  headers: {
    "User-Agent": "ai-nav-collector/0.1 (+https://github.com/)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

function loadJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function stripHtml(input) {
  return String(input || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, max = 140) {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, max).join("")}…`;
}

function pickScenes(title, excerpt) {
  const text = `${title} ${excerpt}`;
  return SCENE_RULES.filter((rule) => rule.pattern.test(text)).map(
    (rule) => rule.id,
  );
}

function normalizeDate(value) {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

async function fetchSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ai-nav-collector/0.1 (+local)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    let xml = await response.text();
    xml = xml.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    const feed = await parser.parseString(xml);
    const items = [];
    for (const entry of feed.items || []) {
      const title = stripHtml(entry.title || "");
      const sourceUrl = (entry.link || "").trim();
      if (!title || !sourceUrl) continue;

      const excerptRaw = stripHtml(
        entry.contentSnippet || entry.summary || entry.content || "",
      );
      const excerpt = truncate(excerptRaw, 140);
      const haystack = `${title} ${excerpt}`;
      if (!AI_PATTERN.test(haystack)) continue;

      items.push({
        title,
        sourceName: source.name,
        sourceUrl,
        publishedAt: normalizeDate(entry.isoDate || entry.pubDate),
        excerpt,
        scenes: pickScenes(title, excerpt),
        collectedAt: new Date().toISOString(),
      });
    }
    return items;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const sources = loadJson(join(dataDir, "sources.json"), []).filter(
    (s) => s.enabled !== false,
  );
  const existing = loadJson(join(dataDir, "news.json"), []);
  const byUrl = new Map(existing.map((item) => [item.sourceUrl, item]));

  const runLog = {
    ranAt: new Date().toISOString(),
    sources: [],
    added: 0,
  };

  let hardFail = false;

  for (const source of sources) {
    const sourceLog = { name: source.name, ok: false, fetched: 0, error: "" };
    try {
      const items = await fetchSource(source);
      sourceLog.ok = true;
      sourceLog.fetched = items.length;
      for (const item of items) {
        if (byUrl.has(item.sourceUrl)) continue;
        byUrl.set(item.sourceUrl, item);
        runLog.added += 1;
      }
    } catch (error) {
      sourceLog.error = error instanceof Error ? error.message : String(error);
      hardFail = true;
      console.error(`[collect] ${source.name} failed:`, sourceLog.error);
    }
    runLog.sources.push(sourceLog);
  }

  const merged = [...byUrl.values()].sort((a, b) =>
    a.publishedAt < b.publishedAt ? 1 : -1,
  );

  writeFileSync(join(dataDir, "news.json"), `${JSON.stringify(merged, null, 2)}\n`);

  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const logsPath = join(logDir, "collect.json");
  const prevLogs = loadJson(logsPath, []);
  const nextLogs = [runLog, ...prevLogs].slice(0, 14);
  writeFileSync(logsPath, `${JSON.stringify(nextLogs, null, 2)}\n`);

  console.log(
    `[collect] sources=${sources.length} added=${runLog.added} total=${merged.length}`,
  );

  if (hardFail && !skipOnFail && runLog.added === 0 && existing.length === 0) {
    // First run with total failure should surface, but don't block empty bootstrap.
  }

  if (hardFail && !skipOnFail) {
    const allFailed = runLog.sources.every((s) => !s.ok);
    if (allFailed) {
      console.warn("[collect] all sources failed; news.json left as merged state");
    }
  }
}

main().catch((error) => {
  console.error("[collect] fatal:", error);
  if (skipOnFail) {
    console.warn("[collect] skip-on-fail enabled, continuing");
    process.exit(0);
  }
  process.exit(1);
});
