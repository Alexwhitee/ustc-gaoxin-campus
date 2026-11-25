import { describe, expect, it } from "vitest";
import { renderWorldAsync, type WorldBitmap } from "@/lib/campus/render";
import { loadCampusPack } from "@/lib/campus/registry";
import { resolveZones } from "@/lib/campus/zones";
import { findPath, nearestFreeTile } from "@/lib/campus/botpath";

function mockCanvas(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  if (g.document) return;
  const makeCtx = () => {
    const noop = () => undefined;
    return new Proxy(
      {
        canvas: null,
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        putImageData: noop,
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
        }),
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
        measureText: () => ({ width: 10 }),
        save: noop,
        restore: noop,
        clip: noop,
        translate: noop,
        scale: noop,
        rotate: noop,
      } as Record<string, unknown>,
      {
        get(t, prop) {
          if (prop in t) return t[prop as string];
          return noop;
        },
        set() {
          return true;
        },
      },
    );
  };
  const create = () => ({
    width: 0,
    height: 0,
    getContext: () => makeCtx(),
  });
  g.document = { createElement: () => create(), fonts: { ready: Promise.resolve(), load: async () => [] } };
  g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(0), 0) as unknown as number;
  g.Path2D = class {
    moveTo() {}
    lineTo() {}
    closePath() {}
    arc() {}
    arcTo() {}
    rect() {}
    ellipse() {}
  };
}

describe("校园渲染管线冒烟测试", () => {
  it("两个校园包都能渲染且产出 2.5D 立面 / 水面帧", async () => {
    mockCanvas();
    for (const id of ["jlu", "ustc"]) {
      const pack = await loadCampusPack(id);
      const bm: WorldBitmap = await renderWorldAsync(pack);
      expect(bm.facades.length).toBeGreaterThan(0);
      expect(bm.canvas.width).toBe(pack.world.w * 16);
      expect(bm.canvas.height).toBe(pack.world.h * 16);
      expect(bm.waters.length).toBe(pack.lakes.length);
      // 每栋楼都有独立的屋顶+立面画布，且高度 > footprint
      for (const f of bm.facades) {
        expect(f.canvas.height).toBeGreaterThan(0);
        expect(f.depth).toBeGreaterThan(0);
      }
      // 出生点可走
      expect(nearestFreeTile(bm.solid, bm.w, bm.h, Math.floor(bm.spawn.x), Math.floor(bm.spawn.y))).not.toBeNull();
      //  zones 可解析
      const zones = resolveZones(pack);
      expect(zones.length).toBeGreaterThan(0);
      for (const z of zones) {
        expect(z.name.length).toBeGreaterThan(0);
        expect(z.x + z.w).toBeLessThanOrEqual(pack.world.w + 1);
      }
    }
  }, 60000);

  it("BFS 寻路能在地图内找到路径", async () => {
    mockCanvas();
    const pack = await loadCampusPack("jlu");
    const bm = await renderWorldAsync(pack);
    const from = nearestFreeTile(bm.solid, bm.w, bm.h, bm.spawn.x, bm.spawn.y)!;
    let found = 0;
    for (const s of pack.bots.spots.slice(0, 6)) {
      const to = nearestFreeTile(bm.solid, bm.w, bm.h, s.x, s.y);
      if (!to) continue;
      const path = findPath(bm.solid, bm.w, bm.h, from, to);
      if (path && path.length) found++;
    }
    expect(found).toBeGreaterThan(0);
  }, 60000);
});
