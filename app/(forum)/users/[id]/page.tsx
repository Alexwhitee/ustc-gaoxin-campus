import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Avatar, LevelBadge } from "@/components/ui/avatar";
import { PostCard } from "@/components/forum/post-card";
import { FollowButton } from "@/components/forum/follow-button";
import { getUser, getUserStats, listPosts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await getUser(id);
  return { title: user ? `${user.name} 的主页` : "用户" };
}

export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();

  const [stats, { posts }] = await Promise.all([getUserStats(id), listPosts({ authorId: id })]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="flex items-start gap-4 rounded-xl border bg-card p-6">
        <Avatar name={user.name} emoji={user.avatar} className="size-16 text-3xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold">{user.name}</h1>
            <LevelBadge level={user.level} />
          </div>
          {user.bio && <p className="mt-1 text-sm text-muted-foreground">{user.bio}</p>}
          <div className="mt-3 flex gap-6 text-sm">
            <span>
              <b className="tabular-nums">{stats.posts}</b>{" "}
              <span className="text-muted-foreground">帖子</span>
            </span>
            <span>
              <b className="tabular-nums">{stats.followers}</b>{" "}
              <span className="text-muted-foreground">关注者</span>
            </span>
            <span>
              <b className="tabular-nums">{stats.following}</b>{" "}
              <span className="text-muted-foreground">正在关注</span>
            </span>
          </div>
        </div>
        <FollowButton userId={id} />
      </header>

      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        {posts.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">
            还没有发过帖子。
          </div>
        ) : (
          posts.map((p) => <PostCard key={p.number} post={p} author={user} />)
        )}
      </div>
    </main>
  );
}
