"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TOPICS } from "@/lib/types";
import type { User } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { LoginDialog } from "@/components/forum/login-dialog";
import { toast } from "sonner";

export function RightRail({
  hotTopics,
  activeUsers,
}: {
  hotTopics: { slug: string; name: string; posts7d: number }[];
  activeUsers: User[];
}) {
  const { me } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [checkedToday, setCheckedToday] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!me) return;
    fetch("/api/checkin")
      .then((r) => r.json())
      .then((d) => {
        setCheckedToday(Boolean(d.checkedToday));
        setStreak(d.streak ?? 0);
      })
      .catch(() => {});
  }, [me]);

  const checkin = async () => {
    try {
      const res = await fetch("/api/checkin", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "签到失败");
        setCheckedToday(true);
        return;
      }
      setCheckedToday(true);
      setStreak(data.streak);
      toast.success(`签到成功，经验 +${data.expGained}，已连续签到 ${data.streak} 天`);
    } catch {
      toast.error("签到失败，请重试");
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarCheck className="size-4 text-muted-foreground" />
          每日签到
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {me
              ? checkedToday
                ? `今天已签到 · 连续 ${streak} 天`
                : "签到领经验（+10）"
              : "登录后签到领经验"}
          </span>
          {me ? (
            checkedToday ? (
              <span className="text-sm text-muted-foreground">✅</span>
            ) : (
              <Button size="sm" className="rounded-lg" onClick={checkin}>
                签到
              </Button>
            )
          ) : (
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setLoginOpen(true)}>
              登录
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">正在发生</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">近 7 天帖子最多的话题</p>
        <ul className="mt-3 space-y-2.5">
          {hotTopics.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/topics/${t.slug}`}
                className="flex items-center gap-2 text-sm hover:underline"
              >
                <span className="flex-1 truncate">{t.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{t.posts7d} 篇</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">最近活跃</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">近 7 天发帖最多的人</p>
        <ul className="mt-3 space-y-3">
          {activeUsers.map((u) => (
            <li key={u.id}>
              <Link href={`/users/${u.id}`} className="flex items-center gap-2.5 hover:opacity-80">
                <Avatar name={u.name} emoji={u.avatar} className="size-8" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{u.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Lv{u.level} · {u.posts7d} 篇
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">全部话题</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TOPICS.map((t) => (
            <Link
              key={t.slug}
              href={`/topics/${t.slug}`}
              className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {t.name}
            </Link>
          ))}
        </div>
      </section>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
