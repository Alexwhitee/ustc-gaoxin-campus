"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, ThumbsUp } from "lucide-react";
import { Avatar, LevelBadge } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { LoginDialog } from "@/components/forum/login-dialog";
import { timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import type { User } from "@/lib/types";

export type CommentView = {
  id: string;
  authorId: string;
  parentId?: string;
  content: string;
  createdAt: string;
  location?: string;
  likeCount: number;
  author: User | null;
};

export function CommentSection({
  postNumber,
  initialComments,
}: {
  postNumber: number;
  initialComments: CommentView[];
}) {
  const { me } = useAuth();
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const topLevel = initialComments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => initialComments.filter((c) => c.parentId === id);

  const send = async (parentId: string | null, text: string) => {
    if (!me) {
      setLoginOpen(true);
      return;
    }
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/posts/${postNumber}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: text.trim(), parentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "发送失败");
      }
      setComment("");
      setReplyText("");
      setReplyTo(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发送失败，请重试");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="divide-y">
        {topLevel.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            还没有评论，坐个沙发？
          </p>
        )}
        {topLevel.map((c) => (
          <div key={c.id} className="px-4 py-4 sm:px-5">
            <CommentRow c={c} onReply={() => setReplyTo(replyTo === c.id ? null : c.id)} />
            {repliesOf(c.id).length > 0 && (
              <div className="mt-3 space-y-3 border-l-2 pl-4">
                {repliesOf(c.id).map((r) => (
                  <CommentRow key={r.id} c={r} small onReply={() => setReplyTo(replyTo === r.id ? null : r.id)} />
                ))}
              </div>
            )}
            {replyTo === c.id && (
              <div className="mt-2 flex gap-2 pl-4 sm:pl-6">
                <Input
                  autoFocus
                  placeholder={`回复 ${c.author?.name ?? ""}……`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send(c.id, replyText)}
                />
                <Button size="sm" className="shrink-0" disabled={sending} onClick={() => send(c.id, replyText)}>
                  回复
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t p-4">
        <Input
          placeholder={me ? "输入评论……" : "登录后参与讨论"}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(null, comment)}
        />
        <Button disabled={sending} onClick={() => send(null, comment)} className="shrink-0">
          发送
        </Button>
      </div>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}

function CommentRow({
  c,
  small,
  onReply,
}: {
  c: CommentView;
  small?: boolean;
  onReply: () => void;
}) {
  return (
    <div className={small ? "" : ""}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar name={c.author?.name ?? "?"} emoji={c.author?.avatar} className={small ? "size-6" : "size-7"} />
        <span className="font-medium text-foreground">{c.author?.name ?? "已注销"}</span>
        {c.author && <LevelBadge level={c.author.level} />}
        <span>{timeAgo(c.createdAt)}</span>
        {c.location && <span>{c.location}</span>}
      </div>
      <p className={`mt-1.5 whitespace-pre-wrap text-sm leading-6 ${small ? "pl-9" : "pl-9"}`}>
        {small && <CornerDownRight className="mr-1 inline size-3.5 text-muted-foreground" />}
        {c.content}
      </p>
      <div className="mt-1 flex items-center gap-4 pl-9 text-xs text-muted-foreground">
        <button className="flex items-center gap-1 hover:text-foreground">
          <ThumbsUp className="size-3.5" />
          {c.likeCount > 0 ? `赞 ${c.likeCount}` : "赞"}
        </button>
        <button className="hover:text-foreground" onClick={onReply}>
          回复
        </button>
      </div>
    </div>
  );
}
