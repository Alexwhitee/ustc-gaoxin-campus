"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Heart, MessageCircle, UserPlus, CornerDownRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth-provider";
import { timeAgo } from "@/lib/utils";
import type { User } from "@/lib/types";

type NotificationView = {
  id: string;
  type: string;
  postNumber: number | null;
  postTitle?: string;
  read: boolean;
  createdAt: string;
  actor: User;
};

const TYPE_META: Record<string, { icon: typeof Bell; text: () => string }> = {
  comment: { icon: MessageCircle, text: () => "评论了你的帖子" },
  reply: { icon: CornerDownRight, text: () => "回复了你的评论" },
  like: { icon: Heart, text: () => "赞了你的帖子" },
  follow: { icon: UserPlus, text: () => "关注了你" },
};

export default function NotificationsPage() {
  const { me, loaded } = useAuth();
  const [items, setItems] = useState<NotificationView[] | null>(null);

  useEffect(() => {
    if (!me) return;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setItems(d.notifications ?? []))
      .catch(() => setItems([]));
  }, [me]);

  // 打开页面即标记已读
  useEffect(() => {
    if (items && items.some((i) => !i.read)) {
      fetch("/api/notifications", { method: "POST" }).catch(() => {});
    }
  }, [items]);

  if (loaded && !me) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <Bell className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">通知</h1>
        <p className="mt-2 text-sm text-muted-foreground">登录后，别人回复、点赞和关注都会出现在这里。</p>
        <Link href="/" className="mt-6 inline-block text-sm text-primary hover:underline">
          返回首页
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-bold">通知</h1>
      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        {items === null ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">加载中……</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            还没有通知。多发帖多评论，互动会找上门来。
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((n) => {
              const meta = TYPE_META[n.type] ?? { icon: Bell, text: () => "和你互动" };
              const Icon = meta.icon;
              return (
                <li key={n.id} className={n.read ? "" : "bg-primary/[0.04]"}>
                  <Link
                    href={n.postNumber ? `/posts/${n.postNumber}` : `/users/${n.actor.id}`}
                    className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-accent/50"
                  >
                    <Avatar name={n.actor.name} emoji={n.actor.avatar} className="size-8" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{n.actor.name}</span>{" "}
                        <span className="text-muted-foreground">{meta.text()}</span>
                        {n.postTitle && (
                          <span className="ml-1 text-muted-foreground">「{n.postTitle.slice(0, 24)}」</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                    </div>
                    <Icon className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
