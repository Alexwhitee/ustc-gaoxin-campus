import { Feed } from "@/components/forum/feed";
import { RightRail } from "@/components/forum/right-rail";
import { activeUsers, getUser, hotTopics, listPosts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { posts, hasMore } = await listPosts();

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
        <Feed
          initialPosts={posts.map((p) => ({ ...p, author: authors.get(p.authorId) ?? null }))}
          initialHasMore={hasMore}
        />
      </div>
      <aside className="hidden w-80 shrink-0 xl:block">
        <RightRail hotTopics={await hotTopics()} activeUsers={await activeUsers()} />
      </aside>
    </main>
  );
}
