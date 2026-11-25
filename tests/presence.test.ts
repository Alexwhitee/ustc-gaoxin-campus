import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/presence/route";

const state = globalThis as unknown as { __jluaiPresence?: Map<string, unknown> };
const player = { id: "player-a", name: "测试同学", campus: "jlu", x: 10, y: 20, dir: 0 };
const send = (body: unknown) => POST(new Request("http://localhost/api/presence", {
  method: "POST", body: JSON.stringify(body),
}));

beforeEach(() => state.__jluaiPresence?.clear());
afterEach(() => vi.restoreAllMocks());

describe("校园 presence", () => {
  it("只返回同校区玩家", async () => {
    await send(player);
    await send({ ...player, id: "other-campus", campus: "ustc" });
    const response = await send({ ...player, id: "player-b" });
    const body = await response.json();
    expect(body.online).toBe(2);
    expect(body.others.map((p: { id: string }) => p.id)).toEqual([player.id]);
  });

  it.each([
    null, {}, { ...player, id: "x".repeat(65) }, { ...player, id: {} },
    { ...player, campus: "unknown" }, { ...player, x: "10" },
    { ...player, x: 1e100 }, { ...player, y: null }, { ...player, dir: 4 },
  ])("拒绝非法输入：%j", async body => {
    expect((await send(body)).status).toBe(400);
  });

  it("限制存储总量，现有玩家仍可更新，过期后释放名额", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    await send(player);
    for (let i = 0; i < 999; i++) {
      state.__jluaiPresence!.set(`p-${i}`, { ...player, ts: now });
    }
    expect((await send({ ...player, id: "overflow" })).status).toBe(503);
    expect((await send(player)).status).toBe(200);
    clock.mockReturnValue(now + 6001);
    expect((await send({ ...player, id: "new-player" })).status).toBe(200);
    expect(state.__jluaiPresence!.size).toBe(1);
  });
});
