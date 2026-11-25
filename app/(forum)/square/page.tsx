import Link from "next/link";
import { hotPosts } from "@/lib/queries";

export const metadata = { title: "广场" };
export const dynamic = "force-dynamic";

export default async function SquarePage() {
  const posts = await hotPosts();

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold">广场</h1>
        <p className="mt-1 text-sm text-muted-foreground">按点赞排序的热门内容。</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {posts.map((p) => (
          <Link
            key={p.number}
            href={`/posts/${p.number}`}
            className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
          >
            <div className="text-xs text-muted-foreground">
              {p.author?.name ?? "已注销"} · 赞 {p.likeCount}
            </div>
            <h2 className="mt-1.5 line-clamp-2 font-semibold leading-snug">{p.title}</h2>
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{p.content}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
