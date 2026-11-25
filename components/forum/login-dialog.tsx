"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, type Me } from "@/components/auth-provider";

const AVATARS = ["🎓", "🐱", "🦊", "🍜", "🚂", "🌸", "🐉", "🏀", "📦", "📖", "🎹", "🌙"];

export function LoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { setMe, refresh } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    if (!name.trim() || !password) {
      toast.error("请输入用户名和密码");
      return;
    }
    if (mode === "register" && !agree) {
      toast.error("注册前请阅读并同意《用户协议》");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password, avatar }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "出错了，稍后再试");
        return;
      }
      const me = data.user as Me;
      setMe(me);
      toast.success(mode === "login" ? `欢迎回来，${me.name}` : `欢迎加入 JLUAI，${me.name}`);
      onOpenChange(false);
      setName("");
      setPassword("");
      await refresh();
      window.location.reload();
    } catch {
      toast.error("网络异常，稍后再试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "login" ? "登录 JLUAI" : "注册 JLUAI"}</DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "用户名 + 密码登录，账号数据保存在服务器。"
              : "注册后可以在论坛发言、在像素地图上行走。"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="用户名（2-20 个字符）"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Input
            placeholder="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {mode === "register" && (
            <>
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">选一个头像</p>
                <div className="flex flex-wrap gap-1.5">
                  {AVATARS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setAvatar(e)}
                      className={`flex size-9 items-center justify-center rounded-lg text-lg transition-colors ${
                        avatar === e ? "bg-primary/15 ring-1 ring-primary" : "bg-muted hover:bg-accent"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 size-3.5 accent-foreground"
                />
                <span>
                  注册前请阅读并同意
                  <a className="text-primary hover:underline" href="/terms" target="_blank">
                    《用户协议》
                  </a>
                </span>
              </label>
            </>
          )}
          <Button className="w-full" onClick={submit} disabled={submitting}>
            {submitting ? "请稍候……" : mode === "login" ? "登录" : "注册并登录"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {mode === "login" ? (
              <>
                还没有账号？
                <button className="text-primary hover:underline" onClick={() => setMode("register")}>
                  注册一个
                </button>
              </>
            ) : (
              <>
                已经有账号了？
                <button className="text-primary hover:underline" onClick={() => setMode("login")}>
                  直接登录
                </button>
              </>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
