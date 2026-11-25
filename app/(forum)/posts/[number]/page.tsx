import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MoreHorizontal } from "lucide-react";
import { Avatar, LevelBadge } from "@/components/ui/avatar";
import { PlaceholderImage } from "@/components/forum/placeholder-image";
import { PostActions } from "@/components/forum/post-actions";
import { CommentSection } from "@/components/forum/comment-section";
import { ViewCounter } from "@/components/forum/view-counter";
import { getSessionUser } from "@/lib/auth";
import { getPost, getUser, listComments } from "@/lib/queries";
import { topicName } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>;
}): Promise<Metadata> {
  const { number } = await params;
  const post = await getPost(Number(number));
  if (!post) return { title: "帖子不存在" };
  return {
    title: post.title,
    description: post.content.slice(0, 120),
    openGraph: { title: post.title, description: post.content.slice(0, 120) },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const viewer = await getSessionUser();
  const post = await getPost(Number(number), viewer?.id);
  if (!post) notFound();

  const author = await getUser(post.authorId);
  const comments = await listComments(post.number);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
      <ViewCounter postNumber={post.number} />
      <article className="min-w-0 flex-1 pb-20">
        <div className="rounded-xl border bg-card px-5 py-6 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Link href={`/users/${post.authorId}`}>
              <Avatar name={author?.name ?? "?"} emoji={author?.avatar} className="size-9" />
            </Link>
            <Link href={`/users/${post.authorId}`} className="text-sm font-medium hover:underline">
              {author?.name ?? "已注销"}
            </Link>
            {author && <LevelBadge level={author.level} />}
            <button className="ml-auto text-muted-foreground hover:text-foreground" aria-label="更多">
              <MoreHorizontal className="size-5" />
            </button>
          </div>

          <h1 className="mt-4 text-2xl font-bold leading-snug">{post.title}</h1>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{formatDateTime(post.createdAt)}</span>
            <span>· IP 属地：{post.location ?? "吉林"}</span>
            <span>· {post.views ?? 0} 次浏览</span>
            {post.topics.map((t) => (
              <Link key={t} href={`/topics/${t}`} className="hover:text-foreground hover:underline">
                · {topicName(t)}
              </Link>
            ))}
          </div>

          <div className="mt-5 whitespace-pre-wrap text-[15px] leading-7 text-foreground/95">
            {post.content}
          </div>

          {post.images && post.images.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {post.images.map((seed) => (
                <div key={seed} className="size-56 overflow-hidden rounded-xl ring-1 ring-border">
                  <PlaceholderImage seed={seed} />
                </div>
              ))}
            </div>
          )}

          <PostActions
            postNumber={post.number}
            likeCount={post.likeCount}
            initialLiked={post.liked}
            initialFavorited={post.favorited}
          />
        </div>
      </article>

      <aside className="hidden w-96 shrink-0 pb-20 lg:block">
        <div className="sticky top-6 space-y-3">
          <h2 className="px-1 text-base font-semibold">评论 {comments.length}</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            <CommentSection postNumber={post.number} initialComments={comments} />
          </div>
        </div>
      </aside>

      {/* 移动端评论区 */}
      <div className="pb-16 lg:hidden">
        <h2 className="mb-3 px-1 text-base font-semibold">评论 {comments.length}</h2>
        <div className="overflow-hidden rounded-xl border bg-card">
          <CommentSection postNumber={post.number} initialComments={comments} />
        </div>
      </div>
    </main>
  );
}
