"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TOPICS } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

const KINDS = [
  { value: "post", label: "帖子" },
  { value: "short", label: "短文" },
  { value: "work", label: "作品" },
] as const;

export function PublishDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { me } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [topic, setTopic] = useState(TOPICS[0].slug);
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("post");
  const [withImages, setWithImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!me) {
      toast.error("请先登录");
      return;
    }
    if (!title.trim() || !content.trim()) {
      toast.error("标题和内容都要填");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          topics: [topic],
          kind,
          images: withImages ? [Math.floor(Math.random() * 90) + 1] : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "发布失败");
      toast.success("发布成功");
      onOpenChange(false);
      setTitle("");
      setContent("");
      setWithImages(false);
      router.push(`/posts/${data.number}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发布失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (!me) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>先登录再发布</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            登录后就可以发帖、评论和点赞了。
          </p>
          <Button onClick={() => onOpenChange(false)}>知道了</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>发布</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  kind === k.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
          <Input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            placeholder="正文……"
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {TOPICS.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => setTopic(t.slug)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  topic === t.slug
                    ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={withImages}
              onChange={(e) => setWithImages(e.target.checked)}
              className="accent-[hsl(var(--primary))]"
            />
            附上几张示意图（自动生成占位图）
          </label>
          <Button className="w-full" onClick={submit} disabled={submitting}>
            {submitting ? "发布中……" : "发布"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
