"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[jluai] 页面出错：", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="text-4xl">🏗️</span>
      <h1 className="mt-4 text-xl font-bold">页面出了点问题</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.digest ? `错误码 ${error.digest} · ` : ""}
        刷新一下通常就能解决。
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          重试
        </button>
        <Link
          href="/"
          className="rounded-xl border px-5 py-2.5 text-sm font-medium hover:bg-accent"
        >
          回首页
        </Link>
      </div>
    </main>
  );
}
