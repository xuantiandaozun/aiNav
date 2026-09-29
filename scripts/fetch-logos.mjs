// 从各工具官网抓取图标，保存到 public/logos，并生成 data/logos.json（slug -> 路径）。
// 只在站长需要更新图标时手动运行：npm run logos
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "logos");
const tools = JSON.parse(readFileSync(join(root, "data", "tools.json"), "utf8"));
const indexPath = join(root, "data", "logos.json");
const index = existsSync(indexPath)
  ? JSON.parse(readFileSync(indexPath, "utf8"))
  : {};

const force = process.argv.includes("--force");
mkdirSync(outDir, { recursive: true });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

async function get(url, timeout = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "*/*" },
    });
  } finally {
    clearTimeout(timer);
  }
}

function extOf(type, url) {
  if (/svg/.test(type)) return "svg";
  if (/png/.test(type)) return "png";
  if (/jpe?g/.test(type)) return "jpg";
  if (/webp/.test(type)) return "webp";
  if (/icon|ico/.test(type)) return "ico";
  const m = /\.(svg|png|jpe?g|webp|ico)(\?|$)/i.exec(url);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : null;
}

function sizeScore(tag) {
  const m = /sizes=["']?(\d+)x(\d+)/i.exec(tag);
  return m ? Number(m[1]) : 0;
}

function pickIconUrls(html, base) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  const found = [];
  for (const tag of tags) {
    if (!/rel=["'][^"']*icon[^"']*["']/i.test(tag)) continue;
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    let score = sizeScore(tag);
    if (/apple-touch-icon/i.test(tag)) score += 200;
    if (/\.svg(\?|$)/i.test(href) || /image\/svg/i.test(tag)) score += 300;
    try {
      found.push({ url: new URL(href, base).href, score });
    } catch {
      /* ignore bad href */
    }
  }
  found.sort((a, b) => b.score - a.score);
  return found.map((f) => f.url);
}

async function download(url) {
  const res = await get(url);
  if (!res.ok) return null;
  const type = (res.headers.get("content-type") || "").toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200 || buf.length > 400_000) return null;
  const ext = extOf(type, url);
  if (!ext) return null;
  if (type.startsWith("text/html")) return null;
  return { buf, ext };
}

async function fetchOne(tool) {
  const candidates = [];
  try {
    const page = await get(tool.websiteUrl);
    if (page.ok) {
      const html = (await page.text()).slice(0, 200_000);
      candidates.push(...pickIconUrls(html, page.url || tool.websiteUrl));
    }
  } catch {
    /* 官网打不开时走备用源 */
  }
  const host = new URL(tool.websiteUrl).hostname;
  candidates.push(`https://www.google.com/s2/favicons?domain=${host}&sz=128`);
  candidates.push(`https://icons.duckduckgo.com/ip3/${host}.ico`);
  candidates.push(`https://api.faviconkit.com/${host}/128`);
  candidates.push(new URL("/favicon.ico", tool.websiteUrl).href);

  for (const url of candidates) {
    try {
      const got = await download(url);
      if (got) return got;
    } catch {
      /* 试下一个 */
    }
  }
  return null;
}

const queue = tools.filter((t) => force || !index[t.slug]);
let done = 0;

async function worker() {
  while (queue.length) {
    const tool = queue.shift();
    const got = await fetchOne(tool);
    done += 1;
    if (got) {
      const file = `${tool.slug}.${got.ext}`;
      writeFileSync(join(outDir, file), got.buf);
      index[tool.slug] = `/logos/${file}`;
      console.log(`[logo] ok   ${tool.slug}`);
    } else {
      console.log(`[logo] miss ${tool.slug}`);
    }
  }
}

await Promise.all(Array.from({ length: 6 }, worker));
writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(`[logo] done ${done}, total with logo ${Object.keys(index).length}/${tools.length}`);
