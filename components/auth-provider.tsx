"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Me = {
  id: string;
  name: string;
  avatar: string;
  level: number;
};

type AuthCtx = {
  me: Me | null;
  loaded: boolean;
  refresh: () => Promise<void>;
  setMe: (me: Me | null) => void;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMeState] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setMeState(data.user ?? null);
    } catch {
      setMeState(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setMe = useCallback((m: Me | null) => setMeState(m), []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setMeState(null);
    // 刷新服务端渲染的内容（等级/身份相关的页面）
    window.location.reload();
  }, []);

  return <Ctx.Provider value={{ me, loaded, refresh, setMe, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}
