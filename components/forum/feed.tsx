"use client";

import { useRef, useState } from "react";
import { PostCard } from "./post-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Post, User } from "@/lib/types";

export type PostWithAuthor = Post & { author: User | null };

export function Feed({ initialPosts, initialHasMore }: { initialPosts: PostWithAuthor[]; initialHasMore?: boolean }) {
  const [tab, setTab] = useState("all");
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore ?? false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = async (t: string, p: number, replace: boolean) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts?tab=${t}&page=${p}`, { signal: ac.signal });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPosts((prev) => (replace ? data.posts : [...prev, ...data.posts]));
      setHasMore(Boolean(data.hasMore));
      setPage(p);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("加载失败，下拉重试");
    } finally {
      if (abortRef.current === ac) setLoading(false);
    }
  };

  const switchTab = (t: string) => {
    if (t === tab) return;
    setTab(t);
    load(t, 1, true);
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-5 py-3">
        <Tabs value={tab} onValueChange={switchTab}>
          <TabsList className="grid w-full grid-cols-4 rounded-full bg-muted p-1">
            <TabsTrigger value="all" className="rounded-full">全部</TabsTrigger>
            <TabsTrigger value="follow" className="rounded-full">关注</TabsTrigger>
            <TabsTrigger value="short" className="rounded-full">短文</TabsTrigger>
            <TabsTrigger value="work" className="rounded-full">作品</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div>
        {loading && posts.length === 0 ? (
          <FeedSkeleton />
        ) : posts.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">
            {tab === "follow"
              ? "关注一些人，这里就会出现他们的动态。去「最近活跃」里找找感兴趣的人吧。"
              : "还没有内容。"}
          </div>
        ) : (
          posts.map((p) => <PostCard key={p.number} post={p} author={p.author ?? undefined} />)
        )}
        {hasMore && (
          <div className="border-t p-3">
            <Button variant="ghost" className="w-full" disabled={loading} onClick={() => load(tab, page + 1, false)}>
              {loading ? "加载中……" : "加载更多"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="divide-y" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-full bg-muted" />
            <div className="space-y-1.5">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-2.5 w-14 rounded bg-muted" />
            </div>
          </div>
          <div className="mt-3 h-4 w-3/4 rounded bg-muted" />
          <div className="mt-2 h-3 w-full rounded bg-muted" />
          <div className="mt-1.5 h-3 w-2/3 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
