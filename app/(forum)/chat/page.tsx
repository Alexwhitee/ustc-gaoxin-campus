"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, LevelBadge } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth-provider";
import { LoginDialog } from "@/components/forum/login-dialog";
import { timeAgo } from "@/lib/utils";
import type { User } from "@/lib/types";

type Msg = { id: number; text: string; at: string; author: User };

export default function ChatPage() {
  const { me } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  // 增量轮询
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/chat?after=${lastIdRef.current}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages?.length) {
          lastIdRef.current = data.messages[data.messages.length - 1].id;
          setMsgs((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            return [...prev, ...data.messages.filter((m: Msg) => !seen.has(m.id))];
          });
        }
      } catch {
        /* 网络抖动忽略，下轮重试 */
      }
    };
    poll();
    const t = setInterval(() => !stop && poll(), 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    if (!text.trim()) return;
    if (!me) {
      setLoginOpen(true);
      return;
    }
    const content = text.trim();
    setText("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "发送失败");
      }
    } catch {
      setText(content);
    }
  };

  return (
    <main className="mx-auto flex h-[calc(100vh-7.5rem)] max-w-3xl flex-col px-4 py-4 sm:px-6 lg:h-[calc(100vh-3rem)]">
      <h1 className="text-xl font-bold">广场聊天</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        消息保存在服务器。想边走边聊？去
        <a href="/campus" className="text-primary hover:underline">
          像素地图
        </a>
        。
      </p>

      <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto rounded-xl border bg-card p-4">
        {msgs.map((m) => {
          const mine = me && m.author.id === me.id;
          return (
            <div key={m.id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
              <Avatar name={m.author.name} emoji={m.author.avatar} className="size-8" />
              <div className={`max-w-[70%] ${mine ? "text-right" : ""}`}>
                <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${mine ? "justify-end" : ""}`}>
                  <span className="font-medium text-foreground">{m.author.name}</span>
                  <LevelBadge level={m.author.level} />
                  <span>{timeAgo(m.at)}</span>
                </div>
                <div
                  className={`mt-1 inline-block rounded-2xl px-3.5 py-2 text-sm leading-6 ${
                    mine ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          placeholder={me ? "说点什么……" : "登录后参与聊天"}
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={send}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
          aria-label="发送"
        >
          <SendHorizontal className="size-4" />
        </button>
      </div>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </main>
  );
}
