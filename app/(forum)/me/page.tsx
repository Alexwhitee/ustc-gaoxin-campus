import Link from "next/link";
import { MePanel } from "@/components/forum/me-panel";
import { PostCard } from "@/components/forum/post-card";
import { getSessionUser } from "@/lib/auth";
import { listFavorites, listPosts } from "@/lib/queries";

export const metadata = { title: "我的" };
export const dynamic = "force-dynamic";

export default async function MePage() {
  const me = await getSessionUser();
  const mine = me ? await listPosts({ authorId: me.id }) : { posts: [], hasMore: false };
  const favorites = me ? await listFavorites(me.id) : [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold">我的</h1>
      <MePanel />

      {me && (
        <>
          <h2 className="mb-3 mt-8 text-base font-semibold">我的帖子（{mine.posts.length}）</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            {mine.posts.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                还没有发过帖子，点侧栏「发布」试试。
              </div>
            ) : (
              mine.posts.map((p) => <PostCard key={p.number} post={p} author={me} />)
            )}
          </div>

          <h2 className="mb-3 mt-8 text-base font-semibold">我的收藏（{favorites.length}）</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            {favorites.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                还没有收藏。帖子页点「收藏」会出现在这里。
              </div>
            ) : (
              favorites.map((p) => <PostCard key={p.number} post={p} author={me} />)
            )}
          </div>
        </>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">
          返回首页
        </Link>
      </p>
    </main>
  );
}
