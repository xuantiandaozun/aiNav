import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const logDir = join(dataDir, "logs");

const ARCHIVE = "https://arctic-shift.photon-reddit.com/api/posts/search";
const BY_ID = "https://arctic-shift.photon-reddit.com/api/posts/ids";
const HN = "https://hn.algolia.com/api/v1/search";
const MAX_LEADS = 120;

const HEADERS = {
  "User-Agent":
    "ai-nav-case-leads/0.1 (+https://github.com/xuantiandaozun/aiNav)",
  Accept: "application/json",
};

const KEEP =
  /built|shipped|launched|revenue|MRR|\$|clients|sold|downloads|income|made |vibe cod/i;

function loadJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function truncate(text, max = 160) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  const chars = Array.from(clean);
  if (chars.length <= max) return clean;
  return `${chars.slice(0, max).join("")}…`;
}

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function toRedditLead(post) {
  const body = String(post.selftext || "");
  if (!body || body === "[removed]" || body === "[deleted]") return null;
  if (post.removed_by_category || post.stickied) return null;
  const title = String(post.title || "").trim();
  if (!title || !KEEP.test(`${title} ${body}`)) return null;
  const permalink = String(post.permalink || "");
  if (!permalink.startsWith("/r/")) return null;
  const created = new Date((post.created_utc || 0) * 1000);
  return {
    id: post.id,
    title,
    sourceName: `Reddit · r/${post.subreddit}`,
    subreddit: post.subreddit,
    score: post.score ?? 0,
    sourceUrl: `https://www.reddit.com${permalink}`,
    excerpt: truncate(body),
    createdAt: Number.isNaN(created.getTime()) ? "" : created.toISOString(),
  };
}

function toHnLead(hit) {
  const title = String(hit.title || "").trim();
  const body = String(hit.story_text || "");
  if (!title || !KEEP.test(`${title} ${body}`)) return null;
  const created = new Date(hit.created_at || 0);
  return {
    id: `hn-${hit.objectID}`,
    title,
    sourceName: "Hacker News",
    subreddit: "",
    score: hit.points ?? 0,
    sourceUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
    excerpt: truncate(body),
    createdAt: Number.isNaN(created.getTime()) ? "" : created.toISOString(),
  };
}

async function fetchRedditListing(source) {
  const sort = source.sort || "top";
  const window = source.t || "month";
  const limit = source.limit || 25;
  const direct = `https://old.reddit.com/r/${source.subreddit}/${sort}.json?t=${window}&limit=${limit}&raw_json=1`;
  try {
    const json = await getJson(direct);
    const rows = (json.data?.children || []).map((child) => child.data);
    return { rows, via: "reddit" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[case-leads] r/${source.subreddit} reddit failed: ${reason}`);
    const archived = await getJson(
      `${ARCHIVE}?subreddit=${encodeURIComponent(source.subreddit)}&limit=${limit}&sort=desc`,
    );
    return { rows: archived.data || [], via: "archive" };
  }
}

async function fetchSeeds(ids) {
  if (!ids.length) return [];
  const direct = `https://old.reddit.com/by_id/${ids.map((id) => `t3_${id}`).join(",")}.json?raw_json=1`;
  try {
    const json = await getJson(direct);
    return (json.data?.children || []).map((child) => child.data);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[case-leads] seed reddit failed: ${reason}`);
    const archived = await getJson(`${BY_ID}?ids=${ids.join(",")}`);
    return archived.data || [];
  }
}

async function main() {
  const config = loadJson(join(dataDir, "case-sources.json"), {});
  const published = new Set(
    loadJson(join(dataDir, "cases.json"), [])
      .map((item) => item.sourceUrl)
      .filter(Boolean),
  );
  const leads = [];
  const runLog = { ranAt: new Date().toISOString(), sources: [], kept: 0 };
  let anyOk = false;

  try {
    const seeded = await fetchSeeds(config.seedIds || []);
    anyOk = true;
    for (const post of seeded) {
      const lead = toRedditLead(post);
      if (lead && !published.has(lead.sourceUrl)) leads.push(lead);
    }
    runLog.sources.push({ name: "reddit-seeds", ok: true, fetched: seeded.length, error: "" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    runLog.sources.push({ name: "reddit-seeds", ok: false, fetched: 0, error: message });
    console.error("[case-leads] seeds failed:", message);
  }

  for (const source of config.reddit || []) {
    const sourceLog = {
      name: `r/${source.subreddit}`,
      ok: false,
      fetched: 0,
      error: "",
    };
    try {
      const { rows, via } = await fetchRedditListing(source);
      anyOk = true;
      sourceLog.ok = true;
      sourceLog.fetched = rows.length;
      sourceLog.via = via;
      for (const post of rows) {
        const lead = toRedditLead(post);
        if (lead && !published.has(lead.sourceUrl)) leads.push(lead);
      }
    } catch (error) {
      sourceLog.error = error instanceof Error ? error.message : String(error);
      console.error(`[case-leads] ${sourceLog.name} failed:`, sourceLog.error);
    }
    runLog.sources.push(sourceLog);
  }

  for (const source of config.hn || []) {
    const sourceLog = { name: `hn:${source.query}`, ok: false, fetched: 0, error: "" };
    try {
      const url = `${HN}?${new URLSearchParams({
        query: source.query,
        tags: "story",
        hitsPerPage: String(source.hits || 15),
      })}`;
      const json = await getJson(url);
      const hits = json.hits || [];
      anyOk = true;
      sourceLog.ok = true;
      sourceLog.fetched = hits.length;
      for (const hit of hits) {
        const lead = toHnLead(hit);
        if (lead && !published.has(lead.sourceUrl)) leads.push(lead);
      }
    } catch (error) {
      sourceLog.error = error instanceof Error ? error.message : String(error);
      console.error(`[case-leads] ${sourceLog.name} failed:`, sourceLog.error);
    }
    runLog.sources.push(sourceLog);
  }

  if (!anyOk || leads.length === 0) {
    console.error("[case-leads] nothing fetched; case-leads.json left unchanged");
    process.exitCode = 1;
  } else {
    const existing = loadJson(join(dataDir, "case-leads.json"), []);
    const byId = new Map(
      existing.filter((item) => item?.id).map((item) => [item.id, item]),
    );
    for (const lead of leads) byId.set(lead.id, lead);
    const merged = [...byId.values()]
      .filter((item) => item.sourceUrl && !published.has(item.sourceUrl))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, MAX_LEADS);

    writeFileSync(
      join(dataDir, "case-leads.json"),
      `${JSON.stringify(merged, null, 2)}\n`,
    );
    runLog.kept = merged.length;
    console.log(`[case-leads] fetched=${leads.length} kept=${merged.length}`);
  }

  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const logsPath = join(logDir, "case-leads.json");
  const prev = loadJson(logsPath, []);
  writeFileSync(
    logsPath,
    `${JSON.stringify([runLog, ...prev].slice(0, 14), null, 2)}\n`,
  );
}

main().catch((error) => {
  console.error("[case-leads] fatal:", error);
  process.exit(1);
});
