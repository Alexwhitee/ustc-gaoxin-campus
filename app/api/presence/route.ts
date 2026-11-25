import { NextResponse } from "next/server";
import { CAMPUS_META } from "@/lib/campus/registry";

export const dynamic = "force-dynamic";

type Presence = {
  name: string;
  campus: string;
  x: number;
  y: number;
  dir: number;
  say: string;
  ts: number;
};

const g = globalThis as unknown as { __jluaiPresence?: Map<string, Presence> };
function store(): Map<string, Presence> {
  if (!g.__jluaiPresence) g.__jluaiPresence = new Map();
  return g.__jluaiPresence;
}

const TTL = 6000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const campus = body?.campus ?? "jlu";
  if (
    typeof body?.id !== "string" || body.id.length === 0 || body.id.length > 64 ||
    !CAMPUS_META.some(c => c.id === campus) ||
    !Number.isFinite(body.x) || !Number.isFinite(body.y) ||
    Math.abs(body.x) > 100_000 || Math.abs(body.y) > 100_000 ||
    !Number.isInteger(body.dir) || body.dir < 0 || body.dir > 3
  ) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const s = store();
  const now = Date.now();
  // 先清理再插入，避免新连接把已过期的连接算进容量。
  for (const [id, p] of s) {
    if (now - p.ts > TTL) s.delete(id);
  }
  if (!s.has(body.id) && s.size >= 1000) {
    return NextResponse.json({ error: "校园人数已满，稍后再试" }, { status: 503 });
  }
  s.set(body.id, {
    name: String(body.name ?? "游客").slice(0, 20),
    campus,
    x: body.x,
    y: body.y,
    dir: body.dir,
    say: String(body.say ?? "").slice(0, 80),
    ts: now,
  });

  // 只返回同一校区的玩家,不同校区互不可见
  const others: {
    id: string;
    name: string;
    campus: string;
    x: number;
    y: number;
    dir: number;
    say: string;
  }[] = [];
  let online = 0;
  for (const [id, p] of s) {
    if (p.campus !== campus) continue;
    online++;
    if (id === body.id) continue;
    others.push({ id, name: p.name, campus: p.campus, x: p.x, y: p.y, dir: p.dir, say: p.say });
  }

  return NextResponse.json({ others, online });
}
