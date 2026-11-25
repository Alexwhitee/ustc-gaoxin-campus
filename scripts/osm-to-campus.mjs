#!/usr/bin/env node
// OSM → 校园包生成器:从 OpenStreetMap 拉取某个大学(或指定 bbox)的
// 建筑/道路/水域/体育设施,投影到像素网格,输出 CampusPack TS 文件。
//
// 用法示例:
//   node scripts/osm-to-campus.mjs \
//     --id ustc --name "中科大像素地图" --subtitle "中国科学技术大学 · 东校区" \
//     --seed "31.8398,117.2630" --grid-w 200 \
//     --out lib/campus/campuses/ustc.ts
//
// 流程:先查 amenity=university 多边形并选中包含 --seed 的那块(找不到则用
// --bbox 手动框范围),再在多边形 bbox 内拉取要素,按多边形裁剪。
// 生成结果为初稿:校门、出生点、装饰、机器人文案需要手工校准。
// 数据 © OpenStreetMap 贡献者(ODbL 1.0)。

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ---------- CLI ----------
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i]?.replace(/^--/, "");
  args[k] = process.argv[i + 1];
}
const ID = args.id ?? "campus";
const NAME = args.name ?? "校园像素地图";
const SUBTITLE = args.subtitle ?? "";
const SEED = args.seed ? String(args.seed).split(",").map(Number) : []; // lat,lon
const BBOX_ARG = args.bbox ? String(args.bbox).split(",").map(Number) : []; // S,W,N,E
const GRID_W = Number(args.gridW ?? args["grid-w"] ?? 200);
const OUT = args.out ?? `lib/campus/campuses/${ID}.ts`;
const LANG = args.lang ?? ""; // 可选:名称语言后缀,如 "zh" 取 name:zh

if (!Number.isFinite(SEED[0]) && BBOX_ARG.length !== 4) {
  console.error("需要 --seed lat,lon 或 --bbox S,W,N,E");
  process.exit(1);
}

// ---------- Overpass ----------
// 顺序按国内可达性调优:mail.ru 快但成功率低(约 1/5),靠重试堆出来;
// overpass-api.de 常对国内 IP 限流(406/502),kumi/private.coffee 大概率超时
const MIRRORS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 campus-pack-generator";

async function overpass(query) {
  let lastErr;
  for (const url of MIRRORS) {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
          body: "data=" + encodeURIComponent(query),
          signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
        const wait = Math.min(3000 * 2 ** attempt, 20000);
        console.warn(`  ${new URL(url).host} 失败(${e.message}),${Math.round(wait / 1000)}s 后重试…`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

const bboxOf = (s, w, n, e) => `(${s},${w},${n},${e})`;

// ---------- 几何工具 ----------
function projector(pBbox, gridW) {
  const [s, w, n, e] = pBbox;
  const lat0 = (s + n) / 2;
  const pxPerLon = gridW / (e - w);
  const pxPerLat = pxPerLon / Math.cos((lat0 * Math.PI) / 180);
  const gridH = Math.max(40, Math.round((n - s) * pxPerLat));
  return {
    gridH,
    toGrid: (lat, lon) => [(lon - w) * pxPerLon, (n - lat) * pxPerLat],
    bbox: pBbox,
  };
}

function wayBbox(geom) {
  let s = 90, w = 180, n = -90, e = -180;
  for (const p of geom) {
    s = Math.min(s, p.lat); n = Math.max(n, p.lat);
    w = Math.min(w, p.lon); e = Math.max(e, p.lon);
  }
  return [s, w, n, e];
}

function centroid(geom) {
  let x = 0, y = 0;
  for (const p of geom) { x += p.lat; y += p.lon; }
  return { lat: x / geom.length, lon: y / geom.length };
}

/** 射线法:点是否在多边形内 */
function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lon, yi = poly[i].lat;
    const xj = poly[j].lon, yj = poly[j].lat;
    if (yi > pt.lat !== yj > pt.lat && pt.lon < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function bboxOverlaps(b1, b2) {
  return !(b1[2] < b2[0] || b1[0] > b2[2] || b1[3] < b2[1] || b1[1] > b2[3]);
}

// ---------- 主流程 ----------
console.log("① 确定范围…");
let campusPolys = [];
let pBbox;
if (Number.isFinite(SEED[0])) {
  // 种子模式:以种子为中心动态宽搜,选包含种子的大学多边形
  const pad = 0.08;
  const wide = bboxOf(SEED[0] - pad, SEED[1] - pad, SEED[0] + pad, SEED[1] + pad);
  const uni = await overpass(`[out:json][timeout:50];way["amenity"="university"]${wide};out geom;`);
  campusPolys = (uni.elements ?? [])
    .filter((el) => el.type === "way" && el.geometry?.length > 3)
    .map((el) => ({ tags: el.tags ?? {}, geometry: el.geometry, bbox: wayBbox(el.geometry) }));
  console.log(`  找到 ${campusPolys.length} 块 university 多边形`);
  const seed = { lat: SEED[0], lon: SEED[1] };
  let hit = campusPolys.find((p) => pointInPolygon(seed, p.geometry));
  if (!hit) {
    campusPolys.sort((a, b) => {
      const da = Math.hypot((a.bbox[0] + a.bbox[2]) / 2 - seed.lat, (a.bbox[1] + a.bbox[3]) / 2 - seed.lon);
      const db = Math.hypot((b.bbox[0] + b.bbox[2]) / 2 - seed.lat, (b.bbox[1] + b.bbox[3]) / 2 - seed.lon);
      return da - db;
    });
    hit = campusPolys[0];
    console.log("  种子点未命中多边形,取最近的一块:", hit.tags.name ?? "(无名)");
  } else {
    console.log("  命中多边形:", hit.tags.name ?? "(无名)");
  }
  pBbox = hit.bbox;
} else if (BBOX_ARG.length === 4) {
  // bbox 模式:不查多边形,所有 bbox 内要素直接保留
  pBbox = BBOX_ARG;
  console.log("  使用手动 bbox");
} else {
  console.error("需要 --seed lat,lon 或 --bbox S,W,N,E");
  process.exit(1);
}
// bbox 稍微外扩,把围墙边角包进来
pBbox = [pBbox[0] - 0.0012, pBbox[1] - 0.0012, pBbox[2] + 0.0012, pBbox[3] + 0.0012];
const proj = projector(pBbox, GRID_W);
console.log(`② 网格 ${GRID_W}×${proj.gridH},bbox=${pBbox.map((v) => v.toFixed(4)).join(",")}`);

console.log("③ 拉取要素…");
const feat = await overpass(
  `[out:json][timeout:90];
(
  way["building"]${bboxOf(...pBbox)};
  way["highway"][highway!~"^(footway|path|steps|cycleway|track|proposed|construction)$"]${bboxOf(...pBbox)};
  way["natural"="water"]${bboxOf(...pBbox)};
  way["leisure"~"^(pitch|track|garden|park|common|playground)$"]${bboxOf(...pBbox)};
);
out geom;`,
);
const elements = feat.elements ?? [];
console.log(`  ${elements.length} 条 way`);

// 与校区的归属判断:有多边形时按多边形,否则只按 bbox
const inCampus = (el) => {
  if (!campusPolys.length) return true;
  const b = wayBbox(el.geometry);
  if (!bboxOverlaps(b, pBbox)) return false;
  const c = centroid(el.geometry);
  return campusPolys.some((p) => pointInPolygon(c, p.geometry));
};
// 道路:任一顶点落在多边形/(bbox)内即保留(路会穿墙,人工修整)
const roadInCampus = (el) => {
  if (!campusPolys.length) return true;
  return el.geometry.some((pt) => campusPolys.some((p) => pointInPolygon(pt, p.geometry)));
};

const pickName = (tags) => {
  if (!tags) return "";
  if (LANG && tags[`name:${LANG}`]) return tags[`name:${LANG}`];
  return tags.name ?? "";
};

// ---------- 建筑 ----------
const CATEGORY_FLOORS = { teaching: 5, lab: 4, library: 5, dorm: 6, canteen: 2, shop: 1, sports: 2, service: 3, landmark: 6 };

function classifyBuilding(name, tags, area) {
  const n = name || "";
  if (tags?.building === "dormitory" || /公寓|宿舍|斋/.test(n)) return "dorm";
  if (/^\d{1,3}#$/.test(n)) return "dorm"; // 中科大风格的编号宿舍楼(如 36#)
  if (/图书馆/.test(n) || tags?.amenity === "library") return "library";
  if (/食堂|餐厅|餐饮/.test(n) || tags?.amenity === "canteen" || tags?.amenity === "restaurant") return "canteen";
  if (/超市|驿站|商店|便利|商业|市场/.test(n)) return "shop";
  if (/体育馆|游泳|球馆|风雨操场/.test(n)) return "sports";
  if (/礼堂|纪念|行政|办公|校史|博物馆|大楼/.test(n)) return "landmark";
  if (/活动|医院|服务|宾馆|酒店|接待|浴池|邮政|快递|报告厅/.test(n)) return "service";
  if (/教学楼/.test(n)) return "teaching";
  if (/实验|科研|研究|学院|实验室/.test(n)) return "lab";
  if (tags?.amenity === "hospital" || tags?.amenity === "clinic" || tags?.amenity === "university") return "service";
  // 兜底:按面积猜
  if (area >= 80) return "teaching";
  if (area >= 24) return "lab";
  return "dorm";
}

const buildings = [];
const seenRects = new Set();
for (const el of elements) {
  if (el.type !== "way" || !el.tags?.building) continue;
  if (!inCampus(el)) continue;
  const g = el.geometry.map((p) => proj.toGrid(p.lat, p.lon));
  const xs = g.map((p) => p[0]), ys = g.map((p) => p[1]);
  const rc = clampRect(
    { x: Math.floor(Math.min(...xs)), y: Math.floor(Math.min(...ys)),
      w: Math.ceil(Math.max(...xs)) - Math.floor(Math.min(...xs)), h: Math.ceil(Math.max(...ys)) - Math.floor(Math.min(...ys)) },
    GRID_W, proj.gridH,
  );
  if (!rc) continue;
  const { x, y, w, h } = rc;
  const name = pickName(el.tags);
  const area = w * h;
  if (area < 5 && !name) continue; // 太小的无名棚子丢弃
  const key = `${x},${y},${w},${h}`;
  if (seenRects.has(key)) continue;
  seenRects.add(key);
  const category = classifyBuilding(name, el.tags, area);
  const levels = parseInt(el.tags["building:levels"] ?? "", 10);
  buildings.push({
    id: `b${el.id}`,
    name,
    category,
    x, y, w, h,
    floors: Number.isFinite(levels) ? levels : CATEGORY_FLOORS[category],
  });
}
console.log(`④ 建筑 ${buildings.length} 栋(有名字 ${buildings.filter((b) => b.name).length} 栋)`);

// ---------- 道路 ----------
const ROAD_WIDTH = { motorway: 3, trunk: 3, primary: 3, secondary: 3, tertiary: 2, residential: 2, unclassified: 2, service: 2, pedestrian: 2, living_street: 2 };
const SKIP_SERVICE = new Set(["driveway", "parking_aisle"]);

function polylineLen(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return len;
}

/** 钳制到世界内,完全在外则返回 null */
function clampRect(r, W, H) {
  const x1 = Math.max(0, r.x), y1 = Math.max(0, r.y);
  const x2 = Math.min(W, r.x + r.w), y2 = Math.min(H, r.y + r.h);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function polylineToRects(geom, width) {
  const rects = [];
  for (let i = 0; i < geom.length - 1; i++) {
    const [x1, y1] = proj.toGrid(geom[i].lat, geom[i].lon);
    const [x2, y2] = proj.toGrid(geom[i + 1].lat, geom[i + 1].lon);
    let r;
    if (Math.abs(x2 - x1) >= Math.abs(y2 - y1)) {
      const cy = (y1 + y2) / 2;
      r = {
        x: Math.round(Math.min(x1, x2)),
        y: Math.round(cy - width / 2),
        w: Math.max(1, Math.round(Math.abs(x2 - x1))),
        h: width,
      };
    } else {
      const cx = (x1 + x2) / 2;
      r = {
        x: Math.round(cx - width / 2),
        y: Math.round(Math.min(y1, y2)),
        w: width,
        h: Math.max(1, Math.round(Math.abs(y2 - y1))),
      };
    }
    const c = clampRect(r, GRID_W, proj.gridH);
    if (c) rects.push(c);
  }
  return rects;
}

const roadsH = [];
const roadsV = [];
for (const el of elements) {
  if (el.type !== "way" || !el.tags?.highway) continue;
  if (!roadInCampus(el)) continue;
  const cls = el.tags.highway;
  const width = ROAD_WIDTH[cls] ?? 2;
  const gridPts = el.geometry.map((p) => proj.toGrid(p.lat, p.lon));
  if (cls === "service") {
    if (SKIP_SERVICE.has(el.tags.service ?? "")) continue;
    if (polylineLen(gridPts) < 6) continue; // 过短的入户车道丢弃
  } else if ((cls === "pedestrian" || cls === "living_street") && polylineLen(gridPts) < 4) {
    continue;
  }
  for (const r of polylineToRects(el.geometry, width)) {
    if (r.w >= r.h) roadsH.push(r);
    else roadsV.push(r);
  }
}
// 同一行/列的矩形合并,压缩数据量
function mergeRows(rects) {
  const rows = new Map();
  for (const r of rects) {
    const key = `${r.y},${r.h}`;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(r);
  }
  const out = [];
  for (const list of rows.values()) {
    list.sort((a, b) => a.x - b.x);
    let cur = { ...list[0] };
    for (let i = 1; i < list.length; i++) {
      const r = list[i];
      if (r.x <= cur.x + cur.w + 1) {
        cur.w = Math.max(cur.w, r.x + r.w - cur.x);
      } else {
        out.push(cur);
        cur = { ...r };
      }
    }
    out.push(cur);
  }
  return out;
}
const roadsHm = mergeRows(roadsH);
const roadsVm = mergeRows(roadsV).map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h }));
console.log(`⑤ 道路段 ${roadsHm.length} 横 + ${roadsVm.length} 竖`);

// ---------- 水域 / 体育 / 绿地 ----------
const lakes = [];
const tracks = [];
const courts = [];
const plazas = [];
for (const el of elements) {
  if (el.type !== "way" || !el.tags) continue;
  const t = el.tags;
  const isWater = t.natural === "water" || t.waterway === "riverbank";
  const isLeisure = !!t.leisure;
  if (!isWater && !isLeisure) continue;
  if (!inCampus(el)) continue;
  const g = el.geometry.map((p) => proj.toGrid(p.lat, p.lon));
  const xs = g.map((p) => p[0]), ys = g.map((p) => p[1]);
  const rc = clampRect(
    { x: Math.floor(Math.min(...xs)), y: Math.floor(Math.min(...ys)),
      w: Math.ceil(Math.max(...xs)) - Math.floor(Math.min(...xs)), h: Math.ceil(Math.max(...ys)) - Math.floor(Math.min(...ys)) },
    GRID_W, proj.gridH,
  );
  if (!rc) continue;
  const { x, y, w, h } = rc;
  const name = pickName(t);
  if (isWater && w * h >= 8) {
    lakes.push({ id: `w${el.id}`, name: name || "湖", x, y, w, h });
  } else if (t.leisure === "track") {
    tracks.push({ id: `t${el.id}`, name: name || "田径场", x, y, w, h });
  } else if (t.leisure === "pitch" && w >= 3 && h >= 3) {
    const sport = t.sport ?? "";
    const kind = /tennis/.test(sport) ? "tennis" : /volleyball/.test(sport) ? "volley" : "basket";
    courts.push({ id: `p${el.id}`, name: name || "球场", x, y, w, h, kind });
  } else if (/^(garden|park|common)$/.test(t.leisure ?? "") && w * h >= 12) {
    plazas.push({ id: `g${el.id}`, name: name || "绿地", x, y, w, h, style: "grass" });
  }
}
console.log(`⑥ 水域 ${lakes.length} · 田径场 ${tracks.length} · 球场 ${courts.length} · 绿地 ${plazas.length}`);

// ---------- 输出 ----------
const cx = Math.round(GRID_W / 2);
const cy = Math.round(proj.gridH / 2);
const pack = {
  id: ID,
  name: NAME,
  subtitle: SUBTITLE,
  credit: "地图数据 © OpenStreetMap 贡献者(ODbL 1.0);由 scripts/osm-to-campus.mjs 生成,人工校准",
  world: { w: GRID_W, h: proj.gridH },
  spawn: { x: cx, y: cy }, // TODO 校准:放到主路上
  defaultPlace: SUBTITLE || NAME, // TODO 校准
  weather: { winterBase: 4, shoulderBase: 17, summerBase: 28 }, // TODO 按城市校准
  roadsH: roadsHm,
  roadsV: roadsVm,
  lakes,
  plazas,
  tracks,
  courts,
  buildings,
  gates: [], // TODO 校准:校门位置
  decorations: {}, // TODO 校准:喷泉/樱花/自行车/公告栏/出生广场
  bots: { names: [], lines: [], spots: [] }, // TODO 校准:机器人昵称/台词/落点
};

const ts = `// 由 scripts/osm-to-campus.mjs 自动生成,再人工校准;数据 © OpenStreetMap 贡献者(ODbL 1.0)
import type { CampusPack } from "../types";

export const ${ID.replace(/[^a-z0-9]/gi, "")}: CampusPack = ${JSON.stringify(pack, null, 2)};
`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, ts);
console.log(`⑦ 已写出 ${OUT}`);
console.log(`   校准清单:spawn / gates / decorations / bots / defaultPlace / weather`);
