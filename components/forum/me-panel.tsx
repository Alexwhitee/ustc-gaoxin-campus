"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { LoginDialog } from "@/components/forum/login-dialog";
import { Avatar, LevelBadge } from "@/components/ui/avatar";
import { useState } from "react";

export function MePanel() {
  const { me, loaded, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  if (!loaded) {
    return <div className="mt-6 h-24 animate-pulse rounded-xl border bg-card" />;
  }

  if (!me) {
    return (
      <>
        <p className="mt-6 rounded-xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          还没有登录。
          <button className="text-primary hover:underline" onClick={() => setLoginOpen(true)}>
            注册 / 登录
          </button>
          后，这里会显示你的资料。
        </p>
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      </>
    );
  }

  return (
    <div className="mt-6 flex items-center gap-4 rounded-xl border bg-card p-6">
      <Avatar name={me.name} emoji={me.avatar} className="size-14" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-lg font-semibold">{me.name}</span>
          <LevelBadge level={me.level} />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">账号数据保存在服务器</p>
      </div>
      <Button variant="outline" onClick={() => logout()}>
        退出登录
      </Button>
    </div>
  );
}
