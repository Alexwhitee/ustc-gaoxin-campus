// 世界渲染器：地面烘焙成一张大图；建筑为独立 2.5D 精灵（屋顶 + 南立面），
// 由场景按 depth 挂载，实现「走到楼后被楼挡住」的正确遮挡。
// 渲染过程分块异步执行（renderWorldAsync），每步让出主线程并回报进度。
import {
  TILE,
  doorOf,
  solidBuildings,
  type Building,
  type BuildingCategory,
  type CampusPack,
  type Rect,
} from "./types";
import { C, roofColor } from "./palette";
import { hashString, seededRandom } from "@/lib/utils";
import { nearestFreeTile } from "./botpath";

/** 单栋建筑的 2.5D 精灵（屋顶俯视 + 南立面） */
export type FacadeSprite = {
  id: string;
  name: string;
  category: BuildingCategory;
  floors: number;
  /** 屋顶+立面纹理 key */
  key: string;
  /** 夜晚亮窗层纹理 key（透明底，只画亮窗）；无亮窗时为 null */
  litKey: string | null;
  /** 放置像素坐标（精灵左上 = footprint 左上） */
  x: number;
  y: number;
  /** = 建筑 footprint 底边 y，玩家/机器人按自身 y 排序即可正确遮挡 */
  depth: number;
  w: number;
  h: number;
  /** 名牌锚点（屋顶中心） */
  labelX: number;
  labelY: number;
  /** 占地格数（LOD 分级用） */
  area: number;
  big: boolean;
  canvas: HTMLCanvasElement;
  litCanvas: HTMLCanvasElement | null;
};

/** 湖面两帧波光（用于 tween 交叉淡入淡出） */
export type WaterAnim = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  keyA: string;
  keyB: string;
  canvasA: HTMLCanvasElement;
  canvasB: HTMLCanvasElement;
};

export type WorldBitmap = {
  canvas: HTMLCanvasElement;
  solid: Uint8Array; // 每格是否不可走
  w: number; // 世界宽(格)
  h: number; // 世界高(格)
  lampPositions: { x: number; y: number }[]; // 像素坐标(格中心)
  facades: FacadeSprite[];
  waters: WaterAnim[];
  /** 校门旗杆顶点（旗帜动画挂点，像素坐标） */
  flags: { x: number; y: number }[];
  /** 主角出生点（已避开建筑） */
  spawn: { x: number; y: number };
};

export type RenderProgress = { percent: number; label: string };

const FONT = "'PingFang SC','Microsoft YaHei',sans-serif";

function markSolid(solid: Uint8Array, w: number, h: number, x: number, y: number, rw: number, rh: number) {
  for (let ty = y; ty < y + rh; ty++) {
    for (let tx = x; tx < x + rw; tx++) {
      if (tx >= 0 && tx < w && ty >= 0 && ty < h) solid[ty * w + tx] = 1;
    }
  }
}

export function isSolid(bm: WorldBitmap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= bm.w || ty >= bm.h) return true;
  return bm.solid[ty * bm.w + tx] === 1;
}

function inRect(r: Rect | undefined, tx: number, ty: number): boolean {
  return !!r && tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
}

/** 颜色变亮/变暗：f>1 变亮，f<1 变暗 */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function toRGB(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------- 地形噪声 ----------
/** 二维 value noise：返回 gw*gh 的 0..1 场（(ns/cell) 决定团块大小） */
function noiseLayer(gw: number, gh: number, cell: number, seed: number): Float32Array {
  const cols = Math.ceil(gw / cell) + 2;
  const rows = Math.ceil(gh / cell) + 2;
  const rnd = seededRandom(seed);
  const lat = new Float32Array(cols * rows);
  for (let i = 0; i < lat.length; i++) lat[i] = rnd();
  const out = new Float32Array(gw * gh);
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < gh; y++) {
    const gy = y / cell;
    const y0 = Math.floor(gy);
    const fy = sm(gy - y0);
    for (let x = 0; x < gw; x++) {
      const gx = x / cell;
      const x0 = Math.floor(gx);
      const fx = sm(gx - x0);
      const a = lat[y0 * cols + x0];
      const b = lat[y0 * cols + x0 + 1];
      const c = lat[(y0 + 1) * cols + x0];
      const d = lat[(y0 + 1) * cols + x0 + 1];
      const top = a + (b - a) * fx;
      const bot = c + (d - c) * fx;
      out[y * gw + x] = top + (bot - top) * fy;
    }
  }
  return out;
}

// ---------- 地表 ----------
/** 草地：低分辨率 value-noise 团块 → 最近邻放大，得到成片色块而非逐格雪花 */
function drawGrass(pack: CampusPack, canvas: HTMLCanvasElement, solid: Uint8Array) {
  const ctx = canvas.getContext("2d")!;
  const W = pack.world.w;
  const H = pack.world.h;
  const S = 2; // 每个噪声像素 = 2x2 屏幕像素
  const gw = Math.ceil((W * TILE) / S);
  const gh = Math.ceil((H * TILE) / S);

  const off = document.createElement("canvas");
  off.width = gw;
  off.height = gh;
  const octx = off.getContext("2d")!;
  const img = octx.createImageData(gw, gh);
  const data = img.data;

  const clump = noiseLayer(gw, gh, 30, 20261026); // 大团块
  const grain = noiseLayer(gw, gh, 8, 778899); // 中等细节
  const field = noiseLayer(gw, gh, 64, 424242); // 超大范围明暗
  const rnd = seededRandom(20261026);

  // 由暗到亮
  const pal = [C.grassDark, C.grass[3], C.grass[1], C.grass[0], C.grass[2]].map(toRGB);
  for (let i = 0; i < gw * gh; i++) {
    const v = clump[i] * 0.56 + grain[i] * 0.26 + field[i] * 0.18;
    let idx = v < 0.4 ? 0 : v < 0.49 ? 1 : v < 0.6 ? 2 : v < 0.72 ? 3 : 4;
    // 稀疏暗草点（密度不到原来的一半）
    if (rnd() > 0.955) idx = 0;
    const rgb = pal[idx];
    const o = i * 4;
    data[o] = rgb[0];
    data[o + 1] = rgb[1];
    data[o + 2] = rgb[2];
    data[o + 3] = 255;
  }
  octx.putImageData(img, 0, 0);

  // 保持最近邻：后续描边/路网都按像素清晰度绘制
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, gw * S, gh * S);

  // 边缘树林（世界外框一圈）
  const rnd2 = seededRandom(313131);
  const woods = [C.tree[2], C.tree[0], "#2e6b34"];
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      if (tx < 2 || ty < 2 || tx >= W - 2 || ty >= H - 2) {
        ctx.fillStyle = woods[Math.floor(rnd2() * woods.length)];
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        solid[ty * W + tx] = 1;
      }
    }
  }
}

// ---------- 道路 ----------
type RoadKind = "main" | "secondary" | "path";
type RoadInfo = { r: Rect; kind: RoadKind; horiz: boolean };

function roadKind(r: Rect): RoadKind {
  const thick = Math.min(r.w, r.h);
  const len = Math.max(r.w, r.h);
  if (thick <= 2) return "path";
  return thick >= 3 && len >= 24 ? "main" : "secondary";
}

function drawRoads(pack: CampusPack, canvas: HTMLCanvasElement, solid: Uint8Array, roads: RoadInfo[]) {
  const ctx = canvas.getContext("2d")!;
  const all: RoadInfo[] = [
    ...pack.roadsH.map((r) => ({ r, kind: roadKind(r), horiz: true })),
    ...pack.roadsV.map((r) => ({ r, kind: roadKind(r), horiz: false })),
  ];
  roads.push(...all);

  for (const info of all) {
    const { r, kind } = info;
    const X = r.x * TILE;
    const Y = r.y * TILE;
    const Wp = r.w * TILE;
    const Hp = r.h * TILE;

    if (kind === "path") {
      // 小径：土色，无路缘、无中线
      ctx.fillStyle = C.path;
      ctx.fillRect(X, Y, Wp, Hp);
      const rnd = seededRandom(r.x * 131 + r.y * 17);
      for (let i = 0; i < r.w * r.h * 2; i++) {
        const px = X + Math.floor(rnd() * Wp);
        const py = Y + Math.floor(rnd() * Hp);
        ctx.fillStyle = C.pathDark;
        ctx.fillRect(px, py, 1, 1);
      }
    } else {
      // 修剪亮带（路肩草坪）+ 路缘石 + 路面
      ctx.fillStyle = C.mown;
      ctx.fillRect(X - 3, Y - 3, Wp + 6, Hp + 6);
      ctx.fillStyle = C.sidewalk;
      ctx.fillRect(X - 2, Y - 2, Wp + 4, Hp + 4);
      ctx.fillStyle = C.road;
      ctx.fillRect(X, Y, Wp, Hp);
      const rnd = seededRandom(r.x * 131 + r.y * 17);
      for (let i = 0; i < r.w * r.h * 3; i++) {
        const px = X + Math.floor(rnd() * Wp);
        const py = Y + Math.floor(rnd() * Hp);
        ctx.fillStyle = C.roadDark;
        ctx.fillRect(px, py, 1, 1);
      }
      // 中线虚线：只有主路有
      if (kind === "main") {
        ctx.fillStyle = C.roadLine;
        if (info.horiz) {
          const cy = Y + Math.floor(Hp / 2) - 1;
          for (let px = X; px < X + Wp - 6; px += 11) ctx.fillRect(px, cy, 6, 2);
        } else {
          const cx = X + Math.floor(Wp / 2) - 1;
          for (let py = Y; py < Y + Hp - 6; py += 11) ctx.fillRect(cx, py, 2, 6);
        }
      }
    }

    for (let ty = Math.max(0, r.y); ty < Math.min(pack.world.h, r.y + r.h); ty++)
      for (let tx = Math.max(0, r.x); tx < Math.min(pack.world.w, r.x + r.w); tx++)
        solid[ty * pack.world.w + tx] = 0; // 道路可走
  }

  drawCrosswalks(canvas, all);
}

function drawCrosswalks(canvas: HTMLCanvasElement, roads: RoadInfo[]) {
  const ctx = canvas.getContext("2d")!;
  const paved = roads.filter((x) => x.kind !== "path");
  for (let i = 0; i < paved.length; i++) {
    for (let j = i + 1; j < paved.length; j++) {
      const a = paved[i];
      const b = paved[j];
      if (a.horiz === b.horiz) continue;
      const h = a.horiz ? a : b;
      const v = a.horiz ? b : a;
      const x0 = Math.max(h.r.x, v.r.x);
      const x1 = Math.min(h.r.x + h.r.w, v.r.x + v.r.w);
      const y0 = Math.max(h.r.y, v.r.y);
      const y1 = Math.min(h.r.y + h.r.h, v.r.y + v.r.h);
      if (x1 <= x0 || y1 <= y0) continue;
      const px0 = x0 * TILE;
      const px1 = x1 * TILE;
      const py0 = y0 * TILE;
      const py1 = y1 * TILE;
      ctx.fillStyle = C.roadLine;
      // 横路斑马线：沿道路延伸方向的短竖条（间隔覆盖 tile 宽度）
      for (let px = px0 + 1; px < px1 - 1; px += 5) {
        ctx.fillRect(px, py0 + 3, 3, py1 - py0 - 6);
      }
      // 竖路斑马线
      for (let py = py0 + 1; py < py1 - 1; py += 5) {
        ctx.fillRect(px0 + 3, py, px1 - px0 - 6, 3);
      }
    }
  }
}

// ---------- 湖泊 ----------
/** 有机岸线：椭圆 + seed 正弦扰动 */
function lakeShape(w: number, h: number, seed: number) {
  const base = seededRandom(seed);
  const harmonics = [
    { k: 3, a: 0.075, p: base() * 6.28 },
    { k: 5, a: 0.05, p: base() * 6.28 },
    { k: 8, a: 0.03, p: base() * 6.28 },
    { k: 12, a: 0.018, p: base() * 6.28 },
  ];
  return (ang: number) => {
    let rr = 1;
    for (const s of harmonics) rr += s.a * Math.sin(s.k * ang + s.p);
    return { x: Math.cos(ang) * rr, y: Math.sin(ang) * rr };
  };
}

function buildLakePath(rx: number, ry: number, scale: number, rng: (a: number) => { x: number; y: number }) {
  const p = new Path2D();
  const steps = 84;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const v = rng(a);
    const x = v.x * rx * scale;
    const y = v.y * ry * scale;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

type LakeGeom = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  bw: number;
  bh: number;
  rng: (a: number) => { x: number; y: number };
};

function drawLakeBase(ctx: CanvasRenderingContext2D, g: LakeGeom, name: string) {
  const { cx, cy, rx, ry, rng } = g;
  ctx.save();
  ctx.translate(cx, cy);
  // 沙岸
  ctx.fillStyle = C.sand;
  ctx.fill(buildLakePath(rx, ry, 1.1, rng));
  // 浅滩
  ctx.fillStyle = C.waterShore;
  ctx.fill(buildLakePath(rx, ry, 1, rng));
  // 深水渐变
  ctx.save();
  ctx.clip(buildLakePath(rx, ry, 0.86, rng));
  const grad = ctx.createLinearGradient(0, -ry, 0, ry);
  grad.addColorStop(0, C.water[2]);
  grad.addColorStop(0.5, C.water[0]);
  grad.addColorStop(1, C.waterDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * 2.4);
  ctx.restore();
  // 湖心深色
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = C.waterDeep;
  ctx.fill(buildLakePath(rx, ry, 0.52, rng));
  ctx.globalAlpha = 1;
  // 湖名水印
  if (name) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `bold ${Math.max(10, Math.min(18, Math.floor(rx / 3)))}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 0, 0);
  }
  ctx.restore();
}

/** 两帧波光：同样的底 + 相位不同的波纹 */
function buildLakeFrame(g: LakeGeom, name: string, phase: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = g.bw;
  cv.height = g.bh;
  const ctx = cv.getContext("2d")!;
  const local: LakeGeom = { ...g, cx: g.bw / 2, cy: g.bh / 2 };
  drawLakeBase(ctx, local, name);
  const { rx, ry, rng } = local;
  ctx.save();
  ctx.translate(local.cx, local.cy);
  ctx.clip(buildLakePath(rx, ry, 0.98, rng));
  for (let y = -ry; y < ry; y += 7) {
    const off = Math.sin(y * 0.35 + phase) * 5;
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    for (let x = -rx; x < rx; x += 15) ctx.fillRect(x + off, y, 7, 2);
    ctx.fillStyle = "rgba(28,78,120,0.16)";
    ctx.fillRect(-rx, y + 4, rx * 2, 1);
  }
  ctx.restore();
  return cv;
}

function drawLakes(pack: CampusPack, canvas: HTMLCanvasElement, solid: Uint8Array, waters: WaterAnim[]) {
  const ctx = canvas.getContext("2d")!;
  for (const lake of pack.lakes) {
    const rx = (lake.w / 2) * TILE;
    const ry = (lake.h / 2) * TILE;
    const cx = (lake.x + lake.w / 2) * TILE;
    const cy = (lake.y + lake.h / 2) * TILE;
    const seed = hashString(lake.id) + lake.x * 7 + lake.y * 13;
    const rng = lakeShape(lake.w, lake.h, seed);
    const geom: LakeGeom = {
      cx,
      cy,
      rx,
      ry,
      bw: Math.ceil(rx * 2 * 1.16) + 4,
      bh: Math.ceil(ry * 2 * 1.16) + 4,
      rng,
    };
    // 静态底图（防水波层未覆盖处的兜底）
    drawLakeBase(ctx, geom, lake.name ?? "");
    waters.push({
      id: lake.id,
      x: cx - geom.bw / 2,
      y: cy - geom.bh / 2,
      w: geom.bw,
      h: geom.bh,
      keyA: `water-a-${lake.id}`,
      keyB: `water-b-${lake.id}`,
      canvasA: buildLakeFrame(geom, lake.name ?? "", 0),
      canvasB: buildLakeFrame(geom, lake.name ?? "", Math.PI * 0.62),
    });
    markSolid(solid, pack.world.w, pack.world.h, lake.x - 1, lake.y - 1, lake.w + 2, lake.h + 2);
  }
}

function drawPlazas(pack: CampusPack, canvas: HTMLCanvasElement, solid: Uint8Array) {
  const ctx = canvas.getContext("2d")!;
  const rnd = seededRandom(991);
  const fountains = new Set(pack.decorations?.fountainPlazaIds ?? []);
  for (const p of pack.plazas) {
    if (p.style === "stone") {
      ctx.fillStyle = C.plaza;
      ctx.fillRect(p.x * TILE, p.y * TILE, p.w * TILE, p.h * TILE);
      for (let i = 0; i < p.w * p.h * 2; i++) {
        const px = p.x * TILE + Math.floor(rnd() * p.w * TILE);
        const py = p.y * TILE + Math.floor(rnd() * p.h * TILE);
        ctx.fillStyle = C.plazaDark;
        ctx.fillRect(px, py, 2, 2);
      }
      for (let ty = p.y; ty < p.y + p.h; ty++)
        for (let tx = p.x; tx < p.x + p.w; tx++) solid[ty * pack.world.w + tx] = 0;
      if (fountains.has(p.id)) {
        const fx = (p.x + p.w / 2) * TILE;
        const fy = (p.y + p.h / 2) * TILE;
        ctx.fillStyle = C.plazaDark;
        ctx.beginPath();
        ctx.arc(fx, fy, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.water[0];
        ctx.beginPath();
        ctx.arc(fx, fy, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.waterDeep;
        ctx.beginPath();
        ctx.arc(fx, fy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(fx - 2, fy - 10, 4, 8);
        markSolid(solid, pack.world.w, pack.world.h, p.x + Math.floor(p.w / 2) - 2, p.y + Math.floor(p.h / 2) - 2, 4, 4);
      }
    } else {
      for (let i = 0; i < p.w * p.h * 6; i++) {
        const px = p.x * TILE + Math.floor(rnd() * p.w * TILE);
        const py = p.y * TILE + Math.floor(rnd() * p.h * TILE);
        const colors = ["#f2d139", "#ef8ba8", "#eef0f2", "#d97fc0"];
        ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
        ctx.fillRect(px, py, 2, 2);
      }
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSports(pack: CampusPack, canvas: HTMLCanvasElement, solid: Uint8Array) {
  const ctx = canvas.getContext("2d")!;
  const W = pack.world.w;
  const H = pack.world.h;
  for (const t of pack.tracks) {
    const x = t.x * TILE;
    const y = t.y * TILE;
    const w = t.w * TILE;
    const h = t.h * TILE;
    ctx.fillStyle = C.track;
    roundRect(ctx, x, y, w, h, Math.min(w, h) / 2);
    ctx.fill();
    ctx.fillStyle = C.field;
    roundRect(ctx, x + 26, y + 18, w - 52, h - 36, Math.min(w - 52, h - 36) / 2);
    ctx.fill();
    ctx.strokeStyle = C.trackLine;
    ctx.lineWidth = 2;
    for (let i = 1; i <= 4; i++) {
      roundRect(ctx, x + 26 - i * 6, y + 18 - i * 4, w - 52 + i * 12, h - 36 + i * 8, (h - 36 + i * 8) / 2);
      ctx.stroke();
    }
    // 起跑线（弯道右侧）
    ctx.strokeStyle = C.trackLine;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + w - 26, y + h / 2, (h - 36) / 2 + 18, -Math.PI / 2.6, Math.PI / 2.6);
    ctx.stroke();
    ctx.lineWidth = 1;
    const rnd = seededRandom(777);
    for (let i = 0; i < 300; i++) {
      const px = x + 28 + Math.floor(rnd() * (w - 56));
      const py = y + 20 + Math.floor(rnd() * (h - 40));
      ctx.fillStyle = rnd() > 0.5 ? "#579a54" : "#6fb168";
      ctx.fillRect(px, py, 2, 2);
    }
    markSolid(solid, W, H, t.x, t.y, t.w, t.h);
    for (let ty = t.y + 2; ty < t.y + t.h - 2; ty++)
      for (let tx = t.x + 3; tx < t.x + t.w - 3; tx++) solid[ty * W + tx] = 0;
  }

  for (const c of pack.courts) {
    const color = c.kind === "basket" ? C.courtBlue : c.kind === "tennis" ? C.tennis : C.courtGreen;
    const cx0 = c.x * TILE;
    const cy0 = c.y * TILE;
    const cw = c.w * TILE;
    const chh = c.h * TILE;
    ctx.fillStyle = color;
    ctx.fillRect(cx0, cy0, cw, chh);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx0 + 3, cy0 + 3, cw - 6, chh - 6);
    if (c.kind === "basket") {
      // 球场两侧的篮架
      for (const bx of [cx0 + 4, cx0 + cw - 4]) {
        ctx.fillStyle = "#4a4a52";
        ctx.fillRect(bx - 1, cy0 + chh / 2 - 12, 2, 24);
        ctx.fillStyle = "#f2efe8";
        ctx.fillRect(bx - 5, cy0 + chh / 2 - 8, 10, 6);
        ctx.strokeStyle = "#c94f43";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - 3, cy0 + chh / 2 - 4, 7, 5);
      }
    } else {
      // 网球场 / 排球场：中间球网
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(cx0 + 3, cy0 + chh / 2 - 1, cw - 6, 2);
      ctx.fillStyle = "#4a4a52";
      ctx.fillRect(cx0 + 1, cy0 + chh / 2 - 7, 2, 14);
      ctx.fillRect(cx0 + cw - 3, cy0 + chh / 2 - 7, 2, 14);
    }
    markSolid(solid, W, H, c.x, c.y, c.w, c.h);
  }
}

// ---------- 建筑 2.5D ----------
const OUTLINE = "rgba(45,40,34,0.85)";

/** 立面视觉高度：随层数增长并封顶 */
function facadeHeight(floors: number): number {
  return Math.max(12, Math.min(10 + floors * 3, 40));
}

/**
 * 生成单栋建筑精灵：上半为 footprint 大小的屋顶（俯视），
 * 下半为南立面（侧视），整体高度 = H + facadeH。
 */
function buildBuildingSprite(b: Building): {
  canvas: HTMLCanvasElement;
  litCanvas: HTMLCanvasElement | null;
  facadeH: number;
  hasLit: boolean;
} {
  const W = b.w * TILE;
  const H = b.h * TILE;
  const fh = facadeHeight(b.floors);
  const roof = roofColor(b.category);
  const rnd = seededRandom(hashString(b.id) + 17);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, W);
  canvas.height = Math.max(3, H + fh);
  const ctx = canvas.getContext("2d")!;
  const litCanvas = document.createElement("canvas");
  litCanvas.width = canvas.width;
  litCanvas.height = canvas.height;
  const lit = litCanvas.getContext("2d")!;
  let hasLit = false;

  drawRoof(ctx, b, W, H, roof, rnd);
  hasLit = drawFacade(ctx, lit, b, W, H, fh, roof, rnd);

  return { canvas, litCanvas: hasLit ? litCanvas : null, facadeH: fh, hasLit };
}

function drawRoof(
  ctx: CanvasRenderingContext2D,
  b: Building,
  W: number,
  H: number,
  roof: string,
  rnd: () => number,
) {
  if (H <= 0) return;
  const dark = shade(roof, 0.78);
  const light = shade(roof, 1.18);
  const cat = b.category;

  // 底色 + 女儿墙（整数描边，总览缩小时轮廓仍可读）
  ctx.fillStyle = roof;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = light;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.fillRect(W - 3, 2, 3, H - 2);
  ctx.fillRect(2, H - 3, W - 2, 3);

  if (cat === "dorm" || cat === "canteen") {
    // 坡瓦顶：横向瓦垄 + 垂直缝
    for (let y = 4; y < H - 3; y += 4) {
      ctx.fillStyle = (y / 4) % 2 === 0 ? shade(roof, 0.9) : shade(roof, 0.96);
      ctx.fillRect(2, y, W - 4, 2);
    }
    ctx.fillStyle = dark;
    for (let x = 6; x < W - 4; x += 13) ctx.fillRect(x, 3, 1, H - 6);
    // 脊线
    ctx.fillStyle = light;
    ctx.fillRect(2, Math.floor(H / 2), W - 4, 1);
    // 烟囱（食堂冒烟）
    if (W > 40 && H > 30 && rnd() > 0.3) {
      const cx = 8 + Math.floor(rnd() * (W - 24));
      ctx.fillStyle = "#8a4a3a";
      ctx.fillRect(cx, 6, 6, 7);
      ctx.fillStyle = "#6e382c";
      ctx.fillRect(cx, 6, 6, 2);
      if (cat === "canteen") {
        ctx.fillStyle = "rgba(230,230,225,0.7)";
        ctx.beginPath();
        ctx.arc(cx + 3, 3, 2, 0, Math.PI * 2);
        ctx.arc(cx + 5, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  if (cat === "library") {
    // 玻璃采光顶
    const gx = Math.max(4, Math.floor(W * 0.16));
    const gw = Math.max(12, W - gx * 2);
    const gy = Math.max(4, Math.floor(H * 0.2));
    const gh2 = Math.max(6, H - gy * 2);
    ctx.fillStyle = "#bcd8e8";
    ctx.fillRect(gx, gy, gw, gh2);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let x = gx + 5; x < gx + gw; x += 7) ctx.fillRect(x, gy, 1, gh2);
    for (let y = gy + 5; y < gy + gh2; y += 7) ctx.fillRect(gx, y, gw, 1);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.strokeRect(gx, gy, gw, gh2);
    return;
  }

  if (cat === "sports") {
    // 拱形条带
    for (let x = 3; x < W - 2; x += 8) {
      ctx.fillStyle = shade(roof, 1.1);
      ctx.fillRect(x, 3, 4, H - 6);
    }
    ctx.fillStyle = light;
    ctx.fillRect(2, 2, W - 4, 2);
    return;
  }

  if (cat === "landmark" && W >= 28 && H >= 40) {
    // 塔楼 + 旗杆旗
    const tw = 14;
    const tx = Math.floor(W / 2 - tw / 2);
    const ty = Math.floor(H / 2 - 8);
    ctx.fillStyle = shade(C.wall, 0.86);
    ctx.fillRect(tx, ty, tw, 14);
    ctx.fillStyle = C.wall;
    ctx.fillRect(tx, ty, tw, 3);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(tx - 3, ty);
    ctx.lineTo(tx + tw / 2, ty - 9);
    ctx.lineTo(tx + tw + 3, ty);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6e6156";
    ctx.fillRect(W - 10, 8, 1, 14);
    ctx.fillStyle = "#c94f43";
    ctx.fillRect(W - 9, 8, 6, 4);
  }

  // 平顶：类别设备
  if (cat === "teaching") {
    for (let y = 6; y < H - 8; y += 10) {
      for (let x = 7; x < W - 12; x += 16) {
        if (rnd() > 0.45) {
          ctx.fillStyle = "#cfe4ee";
          ctx.fillRect(x, y, 8, 5);
          ctx.strokeStyle = shade(roof, 0.7);
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, 7, 4);
        }
      }
    }
  }
  if (cat === "lab" || cat === "teaching" || cat === "shop") {
    const units = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < units; i++) {
      const ux = 8 + Math.floor(rnd() * Math.max(1, W - 24));
      const uy = 6 + Math.floor(rnd() * Math.max(1, H - 18));
      ctx.fillStyle = "#9aa2ac";
      ctx.fillRect(ux, uy, 7, 5);
      ctx.fillStyle = "#6e767f";
      ctx.beginPath();
      ctx.arc(ux + 3.5, uy + 2.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (cat === "lab" && H > 26 && W > 30) {
    // 水箱
    const tx2 = Math.floor(W * 0.65);
    const ty2 = Math.floor(H * 0.45);
    ctx.fillStyle = "#b8bfc7";
    ctx.beginPath();
    ctx.arc(tx2, ty2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e6ebef";
    ctx.fillRect(tx2 - 1, ty2 - 4, 2, 1);
  }
  if (cat === "service" && H > 20 && W > 26) {
    // 屋顶入口小房
    const hx = 7 + Math.floor(rnd() * Math.max(1, W - 24));
    ctx.fillStyle = C.wall;
    ctx.fillRect(hx, 6, 11, 8);
    ctx.fillStyle = shade(C.wall, 0.8);
    ctx.fillRect(hx, 6, 11, 2);
    ctx.fillStyle = C.door;
    ctx.fillRect(hx + 4, 10, 3, 4);
  }
}

/** 画南立面；返回是否存在亮窗 */
function drawFacade(
  ctx: CanvasRenderingContext2D,
  lit: CanvasRenderingContext2D,
  b: Building,
  W: number,
  roofH: number,
  fh: number,
  roof: string,
  rnd: () => number,
): boolean {
  const top = roofH;
  const isBig = b.w * b.h >= 6;
  let hasLit = false;

  // 墙体：左亮右暗
  ctx.fillStyle = C.wall;
  ctx.fillRect(0, top, W, fh);
  ctx.fillStyle = shade(C.wall, 0.88);
  ctx.fillRect(Math.floor(W * 0.72), top, W - Math.floor(W * 0.72), fh);
  ctx.fillStyle = shade(C.wall, 1.08);
  ctx.fillRect(0, top, 2, fh);
  ctx.fillStyle = shade(C.wall, 0.8);
  ctx.fillRect(0, top + fh - 3, W, 3); // 墙脚
  ctx.fillStyle = shade(roof, 0.9);
  ctx.fillRect(0, top, W, 2); // 檐口

  if (!isBig) {
    // 小建筑：只保留轮廓与极简窗，不画大门
    if (W >= 40 && fh >= 16) {
      for (let x = 6; x < W - 10; x += 16) {
        ctx.fillStyle = "#7c8590";
        ctx.fillRect(x, top + 5, 8, 8);
        ctx.fillStyle = C.window;
        ctx.fillRect(x + 1, top + 6, 6, 6);
      }
    }
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, top + 1, W - 2, fh - 2);
    return false;
  }

  if (b.category === "shop" && W >= 30) {
    // 门头招牌带
    ctx.fillStyle = shade(roof, 0.95);
    ctx.fillRect(2, top + 3, W - 4, 6);
    ctx.fillStyle = shade(roof, 1.25);
    ctx.fillRect(2, top + 3, W - 4, 1);
  }

  // 窗户：按楼层排布
  const pitchY = Math.max(8, Math.min(12, Math.floor((fh - 8) / Math.max(1, Math.min(b.floors, 4)))));
  const rows = Math.max(1, Math.min(b.floors, Math.floor((fh - 8) / pitchY)));
  const cols = Math.max(1, Math.floor((W - 10) / 14));
  const startY = top + 5 + (b.category === "shop" ? 7 : 0);
  for (let r = 0; r < rows; r++) {
    for (let c2 = 0; c2 < cols; c2++) {
      const wx = 6 + c2 * Math.floor((W - 12) / cols);
      const wy = startY + r * pitchY;
      if (wy + 8 > top + fh - 6) break;
      if (isDoorColumn(wx, W) && r === rows - 1) continue; // 门上方不留窗
      const isLit = rnd() > 0.7;
      if (isLit) {
        ctx.fillStyle = "#7c8590";
        ctx.fillRect(wx - 1, wy - 1, 9, 10);
        ctx.fillStyle = C.window;
        ctx.fillRect(wx, wy, 7, 8);
        // 亮窗单独画到夜晚层
        lit.fillStyle = C.windowLit;
        lit.fillRect(wx, wy, 7, 8);
        lit.fillStyle = "rgba(255,236,170,0.3)";
        lit.fillRect(wx - 2, wy - 2, 11, 12);
        hasLit = true;
      } else {
        ctx.fillStyle = "#7c8590";
        ctx.fillRect(wx - 1, wy - 1, 9, 10);
        ctx.fillStyle = C.window;
        ctx.fillRect(wx, wy, 7, 8);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(wx, wy, 7, 2);
      }
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(wx + 3, wy, 1, 8);
    }
  }

  // 大门 + 台阶 + 雨棚
  const dw = 12;
  const dx = Math.floor(W / 2) - dw / 2;
  const dh = Math.min(14, fh - 8);
  const dy = top + fh - dh - 2;
  if (b.category === "canteen" || b.category === "shop") {
    for (let i = 0; i < dw + 8; i += 3) {
      ctx.fillStyle = (i / 3) % 2 === 0 ? roof : "#f2efe8";
      ctx.fillRect(dx - 4 + i, dy - 5, 3, 3);
    }
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(dx - 4, dy - 2, dw + 8, 1);
  }
  ctx.fillStyle = C.door;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillRect(dx + 2, dy + 2, 3, dh - 4);
  ctx.fillStyle = C.sidewalk;
  ctx.fillRect(dx - 3, top + fh - 2, dw + 6, 2);
  ctx.fillStyle = shade(C.sidewalk, 0.9);
  ctx.fillRect(dx - 4, top + fh, dw + 8, 2);

  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, top + 1, W - 2, fh - 2);
  return hasLit;
}

function isDoorColumn(wx: number, W: number): boolean {
  const dx = Math.floor(W / 2);
  return Math.abs(wx + 4 - dx) < 8;
}

// ---------- 树木 ----------
type TreeKind = "broad" | "conifer" | "sakura";
type TreeItem = { x: number; y: number; kind: TreeKind; size: number };

function planTrees(
  pack: CampusPack,
  solid: Uint8Array,
  blocked: Uint8Array,
  roads: RoadInfo[],
  rnd: () => number,
): TreeItem[] {
  const W = pack.world.w;
  const H = pack.world.h;
  const sakura = pack.decorations?.sakura;
  const nearRoad = new Set<number>();
  const onRoad = new Set<number>();
  for (const info of roads) {
    for (let ty = info.r.y - 3; ty < info.r.y + info.r.h + 3; ty++) {
      for (let tx = info.r.x - 3; tx < info.r.x + info.r.w + 3; tx++) {
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        if (info.kind !== "path") nearRoad.add(ty * W + tx);
      }
    }
    // 路面本体不长树
    for (let ty = info.r.y; ty < info.r.y + info.r.h; ty++) {
      for (let tx = info.r.x; tx < info.r.x + info.r.w; tx++) {
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        onRoad.add(ty * W + tx);
      }
    }
  }

  const items: TreeItem[] = [];
  const MAX_TREES = 2800;
  for (let cy = 4; cy < H - 4; cy += 7) {
    for (let cx = 4; cx < W - 4; cx += 7) {
      const idx = cy * W + cx;
      if (solid[idx] || blocked[idx]) continue;
      const inSakura = inRect(sakura, cx, cy);
      const roadside = nearRoad.has(idx);
      const p = inSakura ? 0.85 : roadside ? 0.72 : 0.34;
      if (rnd() > p) continue;
      const kind: TreeKind = inSakura ? "sakura" : rnd() > 0.22 ? "broad" : "conifer";
      const n = 4 + Math.floor(rnd() * 7);
      const span = inSakura ? 3.6 : 3.0;
      for (let i = 0; i < n; i++) {
        const ox = Math.round((rnd() + rnd() - 1) * span * TILE);
        const oy = Math.round((rnd() + rnd() - 1) * span * TILE);
        const tx = cx + Math.round(ox / TILE);
        const ty = cy + Math.round(oy / TILE);
        if (tx < 3 || ty < 3 || tx >= W - 3 || ty >= H - 3) continue;
        const ti = ty * W + tx;
        if (solid[ti] || blocked[ti] || onRoad.has(ti)) continue;
        items.push({
          x: tx * TILE,
          y: ty * TILE,
          kind: inSakura ? (rnd() > 0.25 ? "sakura" : "broad") : kind,
          size: rnd() > 0.42 ? 1 : 0,
        });
        solid[ti] = 1;
        if (items.length >= MAX_TREES) return items;
      }
    }
  }
  return items;
}

function drawTrees(items: TreeItem[], canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  // 按 y 升序绘制，保证南边的树压住北边的树
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (const t of sorted) {
    const cx = t.x + TILE / 2;
    const baseY = t.y + TILE;
    // 影子统一朝东南
    ctx.fillStyle = "rgba(30,50,30,0.26)";
    ctx.beginPath();
    ctx.ellipse(cx + 3, baseY - 1, t.size ? 7 : 5, t.size ? 2.6 : 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (t.kind === "conifer") {
      const hgt = t.size ? 17 : 12;
      ctx.fillStyle = C.treeTrunk;
      ctx.fillRect(cx - 1, baseY - 5, 2, 5);
      for (let i = 0; i < 4; i++) {
        const seg = baseY - 4 - i * (hgt / 5);
        const half = Math.max(2, (t.size ? 7 : 5) - i * (t.size ? 1.4 : 1));
        ctx.fillStyle = i % 2 === 0 ? C.tree[2] : C.tree[1];
        ctx.fillRect(cx - half, seg - 4, half * 2, 5);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(cx - half, seg - 4, Math.max(1, half - 1), 1);
      }
      continue;
    }
    const r = t.size ? 6 : 4;
    ctx.fillStyle = C.treeTrunk;
    ctx.fillRect(cx - 1, baseY - (t.size ? 8 : 6), 2, t.size ? 8 : 6);
    const colors = t.kind === "sakura" ? C.sakura : C.tree;
    const base = colors[0];
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(cx, baseY - (t.size ? 9 : 7), r, 0, Math.PI * 2);
    ctx.arc(cx - r * 0.7, baseY - (t.size ? 6 : 5), r * 0.66, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.7, baseY - (t.size ? 6 : 5), r * 0.66, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors[Math.min(colors.length - 1, 1)];
    ctx.beginPath();
    ctx.arc(cx + r * 0.4, baseY - (t.size ? 4 : 3), r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, baseY - (t.size ? 11 : 9), r * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- 其余装饰 ----------
function drawGates(pack: CampusPack, canvas: HTMLCanvasElement, flags: { x: number; y: number }[]) {
  const ctx = canvas.getContext("2d")!;
  for (const g of pack.gates) {
    const x = g.x * TILE;
    const y = g.y * TILE;
    // 门柱基座
    ctx.fillStyle = "#a89b88";
    ctx.fillRect(x - 16, y - 4, 7, 22);
    ctx.fillRect(x + 9, y - 4, 7, 22);
    ctx.fillStyle = "#cfc6b8";
    ctx.fillRect(x - 15, y - 8, 5, 24);
    ctx.fillRect(x + 10, y - 8, 5, 24);
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 14, y - 7, 4, 23);
    ctx.strokeRect(x + 10, y - 7, 4, 23);
    // 横梁
    ctx.fillStyle = "#b9ae9e";
    ctx.fillRect(x - 19, y - 14, 38, 7);
    ctx.strokeRect(x - 18, y - 13, 37, 6);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(x - 18, y - 13, 36, 1);
    ctx.fillStyle = C.label;
    ctx.font = `bold 10px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(g.name, x, y - 10);
    // 旗杆（旗帜由场景做飘动动画）
    ctx.fillStyle = "#6e6156";
    ctx.fillRect(x - 17, y - 22, 1, 9);
    flags.push({ x: x - 17, y: y - 22 });
  }
}

function drawLamps(pack: CampusPack, canvas: HTMLCanvasElement, solid: Uint8Array, roads: RoadInfo[]) {
  const ctx = canvas.getContext("2d")!;
  const lamps: { x: number; y: number }[] = [];
  for (const info of roads) {
    if (info.kind === "path") continue;
    const r = info.r;
    if (info.horiz) {
      for (let tx = r.x + 6; tx < r.x + r.w - 4; tx += 14) lamps.push({ x: (tx + 0.5) * TILE, y: (r.y - 1) * TILE });
    } else {
      for (let ty = r.y + 6; ty < r.y + r.h - 4; ty += 14) lamps.push({ x: (r.x - 1) * TILE, y: (ty + 0.5) * TILE });
    }
  }
  for (const l of lamps) {
    if (l.x < TILE * 2 || l.y < TILE * 2) continue;
    ctx.fillStyle = "#4a4a52";
    ctx.fillRect(l.x - 1, l.y - 14, 2, 16);
    ctx.fillStyle = C.lamp;
    ctx.fillRect(l.x - 3, l.y - 18, 6, 5);
    ctx.fillStyle = "rgba(255,233,168,0.4)";
    ctx.fillRect(l.x - 4, l.y - 19, 8, 1);
    const tx = Math.floor(l.x / TILE);
    const ty = Math.floor(l.y / TILE);
    if (tx >= 0 && tx < pack.world.w && ty >= 0 && ty < pack.world.h) solid[ty * pack.world.w + tx] = 1;
  }
  return lamps;
}

function drawBikesAndProps(pack: CampusPack, canvas: HTMLCanvasElement, solid: Uint8Array) {
  const ctx = canvas.getContext("2d")!;
  const rnd = seededRandom(555777);
  const W = pack.world.w;
  const H = pack.world.h;
  for (const s of pack.decorations?.bikes ?? []) {
    for (let i = 0; i < s.n; i++) {
      const px = (s.x + i * 1.2) * TILE;
      const py = s.y * TILE + (i % 2) * 2;
      ctx.strokeStyle = rnd() > 0.5 ? "#3f5aa6" : "#7a4b3a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py + 8, 3, 0, Math.PI * 2);
      ctx.moveTo(px + 6, py + 8);
      ctx.arc(px + 6, py + 8, 3, 0, Math.PI * 2);
      ctx.moveTo(px + 3, py + 8);
      ctx.lineTo(px + 5, py + 2);
      ctx.lineTo(px + 8, py + 2);
      ctx.stroke();
    }
    for (let i = 0; i < s.n; i++) {
      const tx = Math.floor(s.x + i * 1.2);
      const ty = Math.floor(s.y);
      if (tx >= 0 && tx < W && ty >= 0 && ty < H) solid[ty * W + tx] = 1;
    }
  }
  for (const bd of pack.decorations?.bulletinBoards ?? []) {
    const bx = bd.x * TILE;
    const by = bd.y * TILE;
    ctx.fillStyle = "#4a6fa5";
    ctx.fillRect(bx, by, 12, 10);
    ctx.fillStyle = "#e8e4da";
    ctx.fillRect(bx + 2, by + 2, 8, 5);
    ctx.fillStyle = C.treeTrunk;
    ctx.fillRect(bx + 4, by + 10, 2, 4);
    if (bd.x >= 0 && bd.x < W && bd.y >= 0 && bd.y < H) solid[bd.y * W + bd.x] = 1;
  }
}

/** 建筑投影：统一东南向，画在地表上、建筑之下 */
function drawBuildingShadows(ctx: CanvasRenderingContext2D, buildings: Building[], facadeHOf: (b: Building) => number) {
  ctx.fillStyle = "rgba(30,40,30,0.24)";
  for (const b of buildings) {
    const X = b.x * TILE;
    const Y = b.y * TILE;
    const BW = b.w * TILE;
    const BH = b.h * TILE;
    ctx.fillRect(X + 7, Y + 7, BW, BH);
    ctx.fillRect(X + 7, Y + BH, BW + 4, Math.max(3, facadeHOf(b) * 0.45));
  }
}

/** 等待下一帧：让出主线程，使加载进度可见 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    // 后台标签页的 rAF 会被浏览器暂停,导致渲染卡死;与 setTimeout 竞速兜底
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(once, 100);
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(once);
  });
}

/**
 * 分块异步渲染世界。每完成一步回报进度（0..1），并在步骤之间让出主线程。
 */
export async function renderWorldAsync(
  pack: CampusPack,
  onProgress?: (p: RenderProgress) => void,
  signal?: { aborted: boolean },
): Promise<WorldBitmap> {
  const W = pack.world.w;
  const H = pack.world.h;
  const canvas = document.createElement("canvas");
  canvas.width = W * TILE;
  canvas.height = H * TILE;
  const solid = new Uint8Array(W * H);
  const ctx = canvas.getContext("2d")!;

  const buildings = solidBuildings(pack);
  const roads: RoadInfo[] = [];
  const waters: WaterAnim[] = [];
  const facades: FacadeSprite[] = [];
  const flags: { x: number; y: number }[] = [];
  /** 建筑占地掩码：树与门口空地都不能占用 */
  const bldMask = new Uint8Array(W * H);
  let lampPositions: { x: number; y: number }[] = [];
  let trees: TreeItem[] = [];
  const spawnCandidate = { x: pack.spawn.x, y: pack.spawn.y };

  const steps: { label: string; run: () => void }[] = [
    { label: "铺设草地", run: () => drawGrass(pack, canvas, solid) },
    {
      label: "硬化广场与道路",
      run: () => {
        drawPlazas(pack, canvas, solid);
        drawRoads(pack, canvas, solid, roads);
      },
    },
    {
      label: "开挖湖面与球场",
      run: () => {
        drawLakes(pack, canvas, solid, waters);
        drawSports(pack, canvas, solid);
      },
    },
    { label: "放样楼体地基", run: () => drawBuildingShadows(ctx, buildings, (b) => facadeHeight(b.floors)) },
    {
      label: "规划楼宇占地",
      run: () => {
        for (const b of buildings) markSolid(solid, W, H, b.x, b.y, b.w, b.h);
        for (const b of buildings) markSolid(bldMask, W, H, b.x, b.y, b.w, b.h);
      },
    },
    {
      label: "种下树木",
      run: () => {
        trees = planTrees(pack, solid, bldMask, roads, seededRandom(31415926));
      },
    },
    { label: "描摹树影", run: () => drawTrees(trees, canvas) },
    {
      label: "摆放路灯与装饰",
      run: () => {
        drawBikesAndProps(pack, canvas, solid);
        lampPositions = drawLamps(pack, canvas, solid, roads);
      },
    },
    { label: "搭建校门", run: () => drawGates(pack, canvas, flags) },
    { label: "绘制楼体立面", run: () => buildFacades(buildings, facades) },
  ];

  for (let i = 0; i < steps.length; i++) {
    if (signal?.aborted) throw new Error("render-aborted");
    steps[i].run();
    onProgress?.({ percent: (i + 1) / (steps.length + 1), label: steps[i].label });
    await nextFrame();
  }
  if (signal?.aborted) throw new Error("render-aborted");

  // 门口空地 + 出生广场：保持可走（但不能挖穿楼体）
  const markApron = (tx: number, ty: number) => {
    if (tx < 2 || ty < 2 || tx >= W - 2 || ty >= H - 2) return;
    const idx = ty * W + tx;
    if (bldMask[idx]) return;
    solid[idx] = 0;
  };
  for (const b of buildings) {
    const door = doorOf(b);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = 0; dy <= 2; dy++) markApron(door.x + dx, door.y + dy);
    }
  }
  const apronRect = pack.decorations?.spawnApron;
  if (apronRect) {
    for (let tx = apronRect.x; tx < apronRect.x + apronRect.w; tx++)
      for (let ty = apronRect.y; ty < apronRect.y + apronRect.h; ty++) markApron(tx, ty);
  }

  const spawn = nearestFreeTile(solid, W, H, spawnCandidate.x, spawnCandidate.y) ?? spawnCandidate;

  onProgress?.({ percent: 1, label: "就绪" });
  return { canvas, solid, w: W, h: H, lampPositions, facades, waters, flags, spawn };
}

function buildFacades(buildings: Building[], out: FacadeSprite[]) {
  for (const b of buildings) {
    const sp = buildBuildingSprite(b);
    const Wpx = b.w * TILE;
    const Hpx = b.h * TILE;
    out.push({
      id: b.id,
      name: b.name,
      category: b.category,
      floors: b.floors,
      key: `bld-${b.id}`,
      litKey: sp.litCanvas ? `bld-${b.id}-lit` : null,
      x: b.x * TILE,
      y: b.y * TILE,
      depth: (b.y + b.h) * TILE,
      w: sp.canvas.width,
      h: sp.canvas.height,
      labelX: b.x * TILE + Wpx / 2,
      labelY: b.y * TILE + Math.min(Hpx * 0.5, TILE),
      area: b.w * b.h,
      big: b.w * b.h >= 6,
      canvas: sp.canvas,
      litCanvas: sp.litCanvas,
    });
  }
}
