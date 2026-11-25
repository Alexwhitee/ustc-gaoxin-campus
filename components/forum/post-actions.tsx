"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Share2, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { LoginDialog } from "@/components/forum/login-dialog";

export function PostActions({
  postNumber,
  likeCount,
  initialLiked,
  initialFavorited,
}: {
  postNumber: number;
  likeCount: number;
  initialLiked?: boolean;
  initialFavorited?: boolean;
}) {
  const { me } = useAuth();
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked ?? false);
  const [likes, setLikes] = useState(likeCount);
  const [favorited, setFavorited] = useState(initialFavorited ?? false);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const requireLogin = () => {
    if (me) return true;
    setLoginOpen(true);
    return false;
  };

  const toggleLike = async () => {
    if (!requireLogin()) return;
    const prev = { liked, likes };
    setLiked(!liked);
    setLikes((n) => n + (liked ? -1 : 1));
    try {
      const res = await fetch(`/api/posts/${postNumber}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
      setLikes(data.likeCount);
    } catch {
      setLiked(prev.liked);
      setLikes(prev.likes);
      toast.error("操作失败，请重试");
    }
  };

  const toggleFavorite = async () => {
    if (!requireLogin()) return;
    const prev = favorited;
    setFavorited(!favorited);
    try {
      const res = await fetch(`/api/posts/${postNumber}/favorite`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFavorited(data.favorited);
      toast.success(data.favorited ? "已收藏" : "已取消收藏");
    } catch {
      setFavorited(prev);
      toast.error("操作失败，请重试");
    }
  };

  const sendComment = async () => {
    if (!requireLogin()) return;
    if (!comment.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/posts/${postNumber}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: comment.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "发送失败");
      }
      setComment("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发送失败，请重试");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="mt-6 flex items-center gap-6 border-t pt-4 text-sm text-muted-foreground">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 hover:text-foreground ${liked ? "text-primary" : ""}`}
        >
          <ThumbsUp className="size-4" /> 赞 {likes > 0 ? likes : ""}
        </button>
        <button
          onClick={toggleFavorite}
          className={`flex items-center gap-1.5 hover:text-foreground ${favorited ? "text-primary" : ""}`}
        >
          <Bookmark className="size-4" /> 收藏
        </button>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(location.href);
            toast.success("链接已复制");
          }}
          className="flex items-center gap-1.5 hover:text-foreground"
        >
          <Share2 className="size-4" /> 分享
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        <Input
          placeholder={me ? "输入评论……" : "登录后参与讨论"}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendComment()}
        />
        <Button onClick={sendComment} disabled={sending} variant="secondary" className="shrink-0">
          发送
        </Button>
      </div>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}
