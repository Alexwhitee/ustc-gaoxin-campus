import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, validateRegisterInput, rateLimit } from "@/lib/auth";

describe("密码哈希", () => {
  it("正确密码校验通过，错误密码拒绝", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
    expect(verifyPassword("wrong password", stored)).toBe(false);
  });

  it("每次哈希带随机盐（同密码不同存储值）", () => {
    expect(hashPassword("same-password")).not.toBe(hashPassword("same-password"));
  });

  it("空 hash（种子用户）不可登录", () => {
    expect(verifyPassword("whatever", null)).toBe(false);
    expect(verifyPassword("whatever", "")).toBe(false);
    expect(verifyPassword("whatever", "malformed")).toBe(false);
  });
});

describe("注册输入校验", () => {
  it("合法用户名与密码通过", () => {
    const r = validateRegisterInput("吉大干饭人", "password123");
    expect("error" in r).toBe(false);
  });

  it("用户名过短 / 过长 / 非法字符拒绝", () => {
    expect("error" in validateRegisterInput("a", "password123")).toBe(true);
    expect("error" in validateRegisterInput("x".repeat(21), "password123")).toBe(true);
    expect("error" in validateRegisterInput("bad name!", "password123")).toBe(true);
  });

  it("密码短于 8 位拒绝", () => {
    expect("error" in validateRegisterInput("合法名", "short")).toBe(true);
  });
});

describe("内存限流", () => {
  it("超过每分钟限额后拒绝", () => {
    const key = `test-${Math.random()}`;
    let ok = true;
    for (let i = 0; i < 10; i++) ok = rateLimit(key, 10);
    expect(ok).toBe(true);
    expect(rateLimit(key, 10)).toBe(false);
  });
});
