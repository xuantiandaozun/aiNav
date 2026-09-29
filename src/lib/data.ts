import scenesJson from "../../data/scenes.json";
import toolsJson from "../../data/tools.json";
import casesJson from "../../data/cases.json";
import newsJson from "../../data/news.json";

export type SceneId = "writing" | "image" | "video" | "coding" | "office";

export type Scene = {
  id: SceneId;
  name: string;
};

export type Tool = {
  name: string;
  slug: string;
  summary: string;
  websiteUrl: string;
  scenes: SceneId[];
  price: "免费" | "部分免费" | "付费";
  access: "国内可直接打开" | "打开不稳定";
  status: "草稿" | "公开" | "已下线";
  featured: boolean;
  note: string;
  updatedAt: string;
};

export type CaseItem = {
  title: string;
  slug: string;
  scene: SceneId;
  summary: string;
  tools: string[];
  timeCost: string;
  incomeClaim: string;
  sourceName: string;
  sourceUrl: string;
  status: "草稿" | "公开" | "已撤回";
  publishedAt: string;
};

export type NewsItem = {
  title: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  excerpt: string;
  scenes: SceneId[];
  collectedAt: string;
};

export const scenes = scenesJson as Scene[];
export const allTools = toolsJson as Tool[];
export const allCases = casesJson as CaseItem[];
export const allNews = newsJson as NewsItem[];

export function sceneName(id: string): string {
  return scenes.find((s) => s.id === id)?.name ?? id;
}

export function publishedTools(): Tool[] {
  return allTools
    .filter((t) => t.status === "公开")
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export function featuredTools(limit = 8): Tool[] {
  const published = publishedTools();
  const featured = published.filter((t) => t.featured);
  if (featured.length >= limit) return featured.slice(0, limit);
  const rest = published.filter((t) => !t.featured);
  return [...featured, ...rest].slice(0, limit);
}

export function getTool(slug: string): Tool | undefined {
  return allTools.find((t) => t.slug === slug);
}

export function publishedCases(): CaseItem[] {
  return allCases
    .filter((c) => c.status === "公开")
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function recentCases(limit = 4): CaseItem[] {
  return publishedCases().slice(0, limit);
}

export function getCase(slug: string): CaseItem | undefined {
  return allCases.find((c) => c.slug === slug);
}

export function casesForTool(slug: string): CaseItem[] {
  return publishedCases().filter((c) => c.tools.includes(slug));
}

export function sortedNews(): NewsItem[] {
  return [...allNews].sort((a, b) =>
    a.publishedAt < b.publishedAt ? 1 : -1,
  );
}

export function recentNews(limit = 8): NewsItem[] {
  return sortedNews().slice(0, limit);
}

export function primaryScene(tool: Tool): SceneId {
  return tool.scenes[0] ?? "office";
}

const sourceMarks: Record<string, { mark: string; tone: SceneId }> = {
  机器之心: { mark: "机", tone: "writing" },
  量子位: { mark: "量", tone: "coding" },
  "36氪": { mark: "氪", tone: "video" },
  "InfoQ 中文": { mark: "I", tone: "office" },
};

export function sourceBrand(name: string): { mark: string; tone: SceneId } {
  return (
    sourceMarks[name] ?? {
      mark: (Array.from(name.trim())[0] ?? "?").toUpperCase(),
      tone: "image",
    }
  );
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
