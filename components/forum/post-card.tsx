"use client";

import Link from "next/link";
import { Bookmark, MessageCircle, ThumbsUp, Pin } from "lucide-react";
import { Avatar, LevelBadge } from "@/components/ui/avatar";
import { PlaceholderImage } from "@/components/forum/placeholder-image";
import { timeAgo } from "@/lib/utils";
import { topicName } from "@/lib/types";
import type { Post, User } from "@/lib/types";

export function PostCard({
  post,
  author,
}: {
  post: Post;
  author: User | undefined;
}) {
  const name = author?.name ?? "已注销";
  const kindTag =
    post.kind === "short" ? "短文" : post.kind === "work" ? "作品" : null;

  return (
    <article className="border-b px-5 py-4 last:border-b-0 hover:bg-muted/30">
      <div className="flex gap-3">
        <Link href={`/users/${post.authorId}`} className="shrink-0">
          <Avatar name={name} emoji={author?.avatar} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <Link href={`/users/${post.authorId}`} className="font-medium hover:underline">
              {name}
            </Link>
            <LevelBadge level={author?.level ?? 1} />
            <span className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</span>
            {post.topics.length > 0 && (
              <Link
                href={`/topics/${post.topics[0]}`}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                · {topicName(post.topics[0])}
              </Link>
            )}
            {post.pinned && (
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground" title="置顶">
                <Pin className="size-3.5" /> 置顶
              </span>
            )}
          </div>

          <Link href={`/posts/${post.number}`} className="group mt-1 block">
            <h2 className="font-semibold leading-snug group-hover:underline">
              {post.title}
              {kindTag && (
                <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
                  {kindTag}
                </span>
              )}
            </h2>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {post.content}
            </p>
          </Link>

          {post.images && post.images.length > 0 && (
            <div className="mt-2 flex gap-2">
              {post.images.slice(0, 4).map((seed, i) => (
                <div
                  key={i}
                  className="relative size-28 overflow-hidden rounded-xl ring-1 ring-border"
                >
                  <PlaceholderImage seed={seed} />
                  {i === 3 && post.images!.length > 4 && (
                    <span className="absolute inset-0 flex items-center justify-center bg-foreground/50 text-base font-semibold text-background tabular-nums">
                      +{post.images!.length - 4}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-2.5 flex items-center gap-5 text-muted-foreground">
            <Link
              href={`/posts/${post.number}`}
              className="flex items-center gap-1.5 text-[13px] tabular-nums hover:text-foreground"
            >
              <MessageCircle className="size-4" />
              {post.commentCount > 0 ? post.commentCount : ""}
            </Link>
            <span className="flex items-center gap-1.5 text-[13px] tabular-nums">
              <ThumbsUp className="size-4" />
              {post.likeCount > 0 ? post.likeCount : ""}
            </span>
            <span className="flex items-center gap-1.5 text-[13px] tabular-nums">
              <Bookmark className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
