import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "./db";
import { sessions, users } from "./db/schema";
import type { User } from "./types";

const SESSION_COOKIE = "jluai_session";
const SESSION_TTL = 30 * 86_400_000; // 30 天

// ---------- 密码 ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ---------- 会话 ----------

export type SessionUser = Omit<User, "posts7d" | "followers" | "following"> & { exp: number };

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({
    token,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL,
  });
  return token;
}

export function sessionCookieOptions(req?: Request) {
  // 仅在入口是 HTTPS 时标记 Secure（经 nginx 反代时看 X-Forwarded-Proto），
  // 否则纯 HTTP 部署下浏览器不会回传 cookie
  const proto = req?.headers.get("x-forwarded-proto");
  const secure = proto != null ? proto.split(",")[0].trim() === "https" : process.env.NODE_ENV === "production" && process.env.FORCE_INSECURE_COOKIE !== "1";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_TTL / 1000,
  };
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

/** 读当前登录用户（cookie 有效且未过期）。游客返回 null。 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      avatar: users.avatar,
      bio: users.bio,
      exp: users.exp,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, Date.now())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { ...row, bio: row.bio || undefined, level: levelOf(row.exp) };
}

const levelOf = (exp: number) => Math.min(9, Math.floor(Math.sqrt(Math.max(0, exp) / 20)) + 1);

export async function destroySession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

// ---------- 注册 ----------

const NAME_RE = /^[\p{L}\p{N}_·-]{2,20}$/u;

export function validateRegisterInput(name: unknown, password: unknown): { name: string; password: string } | { error: string } {
  const n = typeof name === "string" ? name.trim() : "";
  const p = typeof password === "string" ? password : "";
  if (!NAME_RE.test(n)) return { error: "用户名需 2-20 个字符（中文、字母、数字、_-·）" };
  if (p.length < 8 || p.length > 64) return { error: "密码需 8-64 个字符" };
  return { name: n, password: p };
}

const AVATARS = ["🎓", "🍜", "🚂", "🌸", "🐉", "🦊", "🎹", "🐱", "📖", "📦", "🏀", "🧋", "🐧", "🦉"];

export const AVATAR_CHOICES = AVATARS;

export function isValidAvatar(a: unknown): boolean {
  return typeof a === "string" && AVATARS.includes(a);
}

/** 新用户 id：u-xxxxxx */
export function newUserId(): string {
  return `u-${randomBytes(4).toString("hex")}`;
}

// ---------- 简单限流（单实例内存态） ----------

const buckets = new Map<string, number[]>();
let lastSweep = 0;

/** 每 IP 每分钟最多 limit 次；超限返回 false */
export function rateLimit(key: string, limit = 10): boolean {
  const now = Date.now();
  const window = 60_000;
  if (now - lastSweep >= window) {
    for (const [id, times] of buckets) {
      if (now - times[times.length - 1] >= window) buckets.delete(id);
    }
    lastSweep = now;
  }
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < window);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
