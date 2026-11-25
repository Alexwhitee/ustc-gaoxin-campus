import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RightRail } from "@/components/forum/right-rail";
import { PostCard } from "@/components/forum/post-card";
import { activeUsers, getUser, hotTopics, listPosts } from "@/lib/queries";
import { TOPICS, topicName } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const topic = TOPICS.find((t) => t.slug === slug);
  return {
    title: topic ? `${topic.name}话题` : "话题",
    description: topic?.description ?? undefined,
  };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = TOPICS.find((t) => t.slug === slug);
  if (!topic) notFound();

  const { posts } = await listPosts({ topic: slug });

  const authors = new Map(
    (
      await Promise.all([...new Set(posts.map((p) => p.authorId))].map(getUser))
    )
      .filter((u): u is NonNullable<typeof u> => u !== null)
      .map((u) => [u.id, u]),
  );

  return (
    <main className="mx-auto flex max-w-6xl gap-6 px-4 py-6 sm:px-6">
      <div className="min-w-0 flex-1">
        <header className="mb-4 rounded-xl border bg-card px-5 py-4">
          <h1 className="text-lg font-bold">{topicName(slug)}</h1>
          {topic.description && (
            <p className="mt-1 text-sm text-muted-foreground">{topic.description}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">共 {posts.length} 篇</p>
        </header>
        <div className="overflow-hidden rounded-xl border bg-card">
          {posts.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-muted-foreground">
              这个话题下还没有帖子，来发第一篇吧。
            </div>
          ) : (
            posts.map((p) => (
              <PostCard key={p.number} post={p} author={authors.get(p.authorId)} />
            ))
          )}
        </div>
      </div>
      <aside className="hidden w-80 shrink-0 xl:block">
        <RightRail hotTopics={await hotTopics()} activeUsers={await activeUsers()} />
      </aside>
    </main>
  );
}
