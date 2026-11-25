// 功能分区：远景(zoom 很小)时显示「教学区 / 宿舍区 / 运动区」大字,
// 让总览缩放下不再是满屏楼名噪音。校园包可用 zones 字段显式声明,
// 未声明时按建筑聚类自动推导。
import { solidBuildings, type BuildingCategory, type CampusPack, type CampusZone } from "./types";
import { seededRandom } from "@/lib/utils";

const CATEGORY_ZONE: Record<BuildingCategory, string> = {
  teaching: "教学区",
  lab: "科研区",
  library: "图书馆区",
  dorm: "宿舍区",
  canteen: "生活饮食区",
  shop: "商业区",
  sports: "运动区",
  service: "服务配套区",
  landmark: "地标区",
};

/** 同一类名多次出现时,按 centroid 落在九宫格的哪一格加方位后缀,避免重名 */
function orientSuffix(cxRatio: number, cyRatio: number): string {
  const ns = cyRatio < 0.33 ? "北" : cyRatio > 0.66 ? "南" : "中";
  const ew = cxRatio < 0.33 ? "西" : cxRatio > 0.66 ? "东" : "中";
  if (ns === "中" && ew === "中") return "中区";
  if (ns === "中") return `${ew}区`;
  if (ew === "中") return `${ns}区`;
  return `${ns}${ew}`;
}

/**
 * k-means 聚类建筑 → 若干矩形分区（确定性：种子固定）。
 * 每类取组内占比最高的建筑类别作为区名。
 */
export function resolveZones(pack: CampusPack): CampusZone[] {
  if (pack.zones && pack.zones.length) return pack.zones;

  const list = solidBuildings(pack);
  if (list.length < 6) return [];

  const k = Math.max(3, Math.min(6, Math.round(list.length / 14)));
  const rnd = seededRandom(90210);
  // 确定性初始点：按 x+y 排序后均匀取样
  const ordered = [...list].sort((a, b) => a.x + a.y - (b.x + b.y));
  const centers: { x: number; y: number }[] = [];
  for (let i = 0; i < k; i++) {
    const b = ordered[Math.floor(((i + 0.5) / k) * ordered.length)];
    centers.push({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  }

  const assign: number[] = new Array(list.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    let moved = false;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = (centers[c].x - cx) ** 2 + (centers[c].y - cy) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assign[i] !== best) moved = true;
      assign[i] = best;
    }
    if (!moved && iter > 0) break;
    // 重算质心
    for (let c = 0; c < centers.length; c++) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let i = 0; i < list.length; i++) {
        if (assign[i] !== c) continue;
        sx += list[i].x + list[i].w / 2;
        sy += list[i].y + list[i].h / 2;
        n++;
      }
      if (!n) continue;
      centers[c] = { x: sx / n, y: sy / n };
    }
    void rnd;
  }

  const groups = new Map<number, typeof list>();
  for (let i = 0; i < list.length; i++) {
    const g = groups.get(assign[i]) ?? [];
    g.push(list[i]);
    groups.set(assign[i], g);
  }

  const usedNames = new Map<string, number>();
  const tmp: { z: CampusZone; base: string; cx: number; cy: number }[] = [];
  const sorted = [...groups.values()].sort((a, b) => b.length - a.length);
  for (const g of sorted) {
    if (g.length < 3) continue;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const tally = new Map<BuildingCategory, number>();
    for (const b of g) {
      x0 = Math.min(x0, b.x);
      y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w);
      y1 = Math.max(y1, b.y + b.h);
      tally.set(b.category, (tally.get(b.category) ?? 0) + 1);
    }
    let topCat: BuildingCategory = "teaching";
    let topN = -1;
    for (const [cat, n] of tally) {
      if (n > topN) {
        topN = n;
        topCat = cat;
      }
    }
    const cx = (x0 + x1) / 2 / pack.world.w;
    const cy = (y0 + y1) / 2 / pack.world.h;
    const base = CATEGORY_ZONE[topCat];
    const seen = usedNames.get(base) ?? 0;
    usedNames.set(base, seen + 1);
    const pad = 4;
    tmp.push({
      z: {
      id: `zone-${tmp.length}`,
      name: base,
      x: Math.max(0, Math.round(x0 - pad)),
      y: Math.max(0, Math.round(y0 - pad)),
      w: Math.min(pack.world.w - Math.max(0, Math.round(x0 - pad)), Math.round(x1 - x0 + pad * 2)),
      h: Math.min(pack.world.h - Math.max(0, Math.round(y0 - pad)), Math.round(y1 - y0 + pad * 2)),
      },
      base,
      cx,
      cy,
    });
  }
  // 同名不同区时先补方位后缀，仍重名则补序号
  const finalSeen = new Map<string, number>();
  return tmp.map((t) => {
    const dup = (usedNames.get(t.base) ?? 1) > 1;
    let name = dup ? `${t.base}·${orientSuffix(t.cx, t.cy)}` : t.base;
    const n = finalSeen.get(name) ?? 0;
    finalSeen.set(name, n + 1);
    if (n > 0) name = `${name}${n + 1}`;
    return { ...t.z, name };
  });
}
