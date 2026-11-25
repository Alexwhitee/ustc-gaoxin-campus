"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginDialog } from "@/components/forum/login-dialog";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { me, loaded } = useAuth();
  const [open, setOpen] = useState(true);

  // 已登录的用户直接回首页
  useEffect(() => {
    if (loaded && me) router.replace("/");
  }, [loaded, me, router]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="text-4xl">🎓</span>
      <h1 className="mt-4 text-xl font-bold">登录 JLUAI</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        登录后可以发帖、评论、点赞、收藏，以及在像素地图上和大家见面。
      </p>
      <button
        onClick={() => setOpen(true)}
        className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        打开登录框
      </button>
      <LoginDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) router.push("/");
        }}
      />
    </main>
  );
}
