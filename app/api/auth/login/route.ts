import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  createSession,
  verifyPassword,
  rateLimit,
  clientIp,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { levelFor } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req)}`, 10)) {
    return NextResponse.json({ error: "操作太频繁，稍后再试" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!name || !password) return NextResponse.json({ error: "请输入用户名和密码" }, { status: 400 });
  if (Array.from(name).length > 20 || password.length > 64) {
    return NextResponse.json({ error: "用户名或密码长度不正确" }, { status: 400 });
  }

  const rows = await db.select().from(users).where(eq(users.name, name)).limit(1);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "用户名或密码不对" }, { status: 401 });
  }

  const token = await createSession(user.id);
  const res = NextResponse.json({
    user: { id: user.id, name: user.name, avatar: user.avatar, level: levelFor(user.exp) },
  });
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(req));
  return res;
}
