import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  createSession,
  hashPassword,
  isValidAvatar,
  newUserId,
  rateLimit,
  clientIp,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  validateRegisterInput,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!rateLimit(`register:${clientIp(req)}`, 5)) {
    return NextResponse.json({ error: "操作太频繁，稍后再试" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = validateRegisterInput(body?.name, body?.password);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.name, parsed.name)).limit(1);
  if (existing[0]) return NextResponse.json({ error: "这个用户名已经被用了" }, { status: 409 });

  const id = newUserId();
  const avatar = isValidAvatar(body?.avatar) ? (body.avatar as string) : "🎓";
  await db.insert(users).values({
    id,
    name: parsed.name,
    passwordHash: hashPassword(parsed.password),
    avatar,
    bio: "",
    exp: 0,
    createdAt: Date.now(),
  });

  const token = await createSession(id);
  const res = NextResponse.json({
    user: { id, name: parsed.name, avatar, level: 1 },
  });
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(req));
  return res;
}
