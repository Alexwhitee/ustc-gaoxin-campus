import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { POST as login } from "@/app/api/auth/login/route";
import { sqlite } from "@/lib/db";
import { sessionCookieOptions, rateLimit, validateRegisterInput } from "@/lib/auth";

afterEach(() => vi.restoreAllMocks());

describe("部署健康检查", () => {
  it("检测真实数据库且禁止缓存", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("数据库故障返回 503 且不泄露错误细节", async () => {
    vi.spyOn(sqlite, "prepare").mockImplementation(() => { throw new Error("private database path"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
});

describe("反向代理及长期运行", () => {
  it("登录长度校验与注册一致，支持扩展汉字", async () => {
    const name = "𠀀".repeat(20);
    expect(validateRegisterInput(name, "password123")).toEqual({ name, password: "password123" });
    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST", body: JSON.stringify({ name, password: "password123" }),
    }));
    expect(response.status).toBe(401);
  });

  it("拒绝超长登录字段，避免不必要的数据库和密码计算", async () => {
    for (const body of [{ name: "x".repeat(21), password: "password" }, { name: "valid-user", password: "x".repeat(65) }]) {
      const response = await login(new Request("http://localhost/api/auth/login", {
        method: "POST", body: JSON.stringify(body),
      }));
      expect(response.status).toBe(400);
    }
  });

  it("HTTPS 代理使用 Secure cookie，HTTP 入口可以登录", () => {
    for (const [proto, secure] of [["https", true], ["http", false]] as const) {
      const request = new Request("http://localhost/api/auth/login", { headers: { "x-forwarded-proto": proto } });
      expect(sessionCookieOptions(request)).toMatchObject({ secure, httpOnly: true, sameSite: "lax" });
    }
  });

  it("回收过期限流记录时保留其他仍有效的限流", () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const key = `expiry-${now}`;
    expect(rateLimit(key, 1)).toBe(true);
    expect(rateLimit(key, 1)).toBe(false);
    clock.mockReturnValue(now + 30_000);
    expect(rateLimit(`${key}-active`, 1)).toBe(true);
    clock.mockReturnValue(now + 60_001);
    expect(rateLimit(key, 1)).toBe(true);
    expect(rateLimit(`${key}-active`, 1)).toBe(false);
  });
});
