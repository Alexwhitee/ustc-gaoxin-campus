// 校园包注册表：新增校园 = 在 campuses/ 下加一个包文件 + 在这里注册。
// 包体本身走动态 import：首屏只拉取当前 ?campus= 对应的那一份数据。
import type { CampusPack } from "./types";

type PackModule = { [key: string]: CampusPack };

/** 静态元信息：下拉列表 / 服务端 metadata 用，不含数千行地图数据 */
export const CAMPUS_META: { id: string; name: string; subtitle: string }[] = [
  { id: "jlu", name: "吉林大学像素地图", subtitle: "像素画风的校园地图 · 中心校区 · 前卫南区" },
  { id: "ustc", name: "中科大像素地图", subtitle: "中国科学技术大学 · 东校区" },
  { id: "ustc-gaoxin", name: "中科大像素地图", subtitle: "中国科学技术大学 · 高新校区" },
];

/** id → 动态载入 + 具名导出 */
const LOADERS: Record<string, () => Promise<PackModule>> = {
  jlu: () => import("./campuses/jlu"),
  ustc: () => import("./campuses/ustc"),
  "ustc-gaoxin": () => import("./campuses/ustc-gaoxin"),
};

const EXPORTS: Record<string, string> = { jlu: "jlu", ustc: "ustc", "ustc-gaoxin": "ustcGaoxin" };

export const DEFAULT_CAMPUS_ID = "jlu";

const cache = new Map<string, CampusPack>();

/** 全部已注册校园(HUD 切换下拉用) */
export function listCampuses(): { id: string; name: string }[] {
  return CAMPUS_META.map((c) => ({ id: c.id, name: c.name }));
}

/** 当前校园:优先 URL 参数 ?campus=,其次环境变量 NEXT_PUBLIC_CAMPUS,默认 jlu */
export function resolveCampusId(): string {
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("campus");
    if (q && LOADERS[q]) return q;
  }
  const env = process.env.NEXT_PUBLIC_CAMPUS;
  if (env && LOADERS[env]) return env;
  return DEFAULT_CAMPUS_ID;
}

/** 异步载入校园包(同 id 只拉一次) */
export async function loadCampusPack(id?: string): Promise<CampusPack> {
  const key = id ?? resolveCampusId();
  const hit = cache.get(key);
  if (hit) return hit;
  const loader = LOADERS[key];
  if (!loader) throw new Error(`未知校园包:${key}`);
  const mod = await loader();
  const pack = mod[EXPORTS[key]];
  cache.set(key, pack);
  return pack;
}

/** 切换校园:写入 ?campus= 并整页跳转(场景需要重新渲染世界) */
export function switchCampus(id: string) {
  if (!LOADERS[id] || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("campus", id);
  window.location.assign(url.toString());
}

/** 静态标题信息(供服务端 metadata 使用,不载入地图数据) */
export function campusMeta(id?: string) {
  const key = id ?? resolveCampusId();
  return CAMPUS_META.find((c) => c.id === key) ?? CAMPUS_META[0];
}
