// 机器人寻路：一次 BFS 得到栅格路径,再做视线拉直,沿路径行走取代随机撞墙。
import { TILE } from "./types";

export type TilePoint = { x: number; y: number };

const MAX_NODES = 9000;

/** 两格之间是否直线可达（采样步进） */
export function hasLine(solid: Uint8Array, w: number, h: number, ax: number, ay: number, bx: number, by: number): boolean {
  const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2;
  if (steps === 0) return true;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const tx = Math.round(ax + (bx - ax) * t);
    const ty = Math.round(ay + (by - ay) * t);
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
    if (solid[ty * w + tx]) return false;
  }
  return true;
}

/** 从指定格向外搜索最近的可走格 */
export function nearestFreeTile(solid: Uint8Array, w: number, h: number, sx: number, sy: number, maxR = 30): TilePoint | null {
  if (sx >= 0 && sy >= 0 && sx < w && sy < h && !solid[sy * w + sx]) return { x: sx, y: sy };
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const tx = sx + dx;
        const ty = sy + dy;
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
        if (!solid[ty * w + tx]) return { x: tx, y: ty };
      }
    }
  }
  return null;
}

/**
 * 4 邻域 BFS 寻路（格坐标）。返回拉直后的路径格序列（含终点,不含起点）,找不到返回 null。
 * 地图为 150x201 量级,单次 BFS 代价极低（<1ms）。
 */
export function findPath(
  solid: Uint8Array,
  w: number,
  h: number,
  from: TilePoint,
  to: TilePoint,
): TilePoint[] | null {
  const start = from.y * w + from.x;
  const goal = to.y * w + to.x;
  if (start === goal) return [];
  if (solid[start] || solid[goal]) return null;

  const prev = new Int32Array(w * h).fill(-1);
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(MAX_NODES);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = 1;
  let found = false;

  while (head < tail && tail < MAX_NODES) {
    const cur = queue[head++];
    if (cur === goal) {
      found = true;
      break;
    }
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const push = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
      const ni = ny * w + nx;
      if (seen[ni] || solid[ni]) return;
      seen[ni] = 1;
      prev[ni] = cur;
      if (tail < MAX_NODES) queue[tail++] = ni;
    };
    push(cx - 1, cy);
    push(cx + 1, cy);
    push(cx, cy - 1);
    push(cx, cy + 1);
  }
  if (!found) return null;

  const rev: TilePoint[] = [];
  let cur = goal;
  while (cur !== start && cur >= 0) {
    const x = cur % w;
    rev.push({ x, y: (cur - x) / w });
    cur = prev[cur];
    if (rev.length > MAX_NODES) break;
  }
  rev.reverse();

  // 视线拉直：能直达的中间点全部丢掉
  const simplified: TilePoint[] = [];
  let cx = from.x;
  let cy = from.y;
  let i = 0;
  while (i < rev.length) {
    let far = i;
    for (let j = rev.length - 1; j >= i; j--) {
      if (hasLine(solid, w, h, cx, cy, rev[j].x, rev[j].y)) {
        far = j;
        break;
      }
    }
    const p = rev[far];
    simplified.push(p);
    cx = p.x;
    cy = p.y;
    i = far + 1;
  }
  return simplified;
}

/** 格坐标 → 像素坐标（格中心） */
export function tileToPixel(p: TilePoint): { x: number; y: number } {
  return { x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE };
}
