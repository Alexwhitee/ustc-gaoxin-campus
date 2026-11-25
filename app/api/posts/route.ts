import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createPost, getUser, listPosts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const viewer = await getSessionUser();
  const { posts, hasMore } = await listPosts({
    topic: searchParams.get("topic") ?? undefined,
    tab: searchParams.get("tab") ?? undefined,
    page: Number(searchParams.get("page") ?? 1) || 1,
    viewerId: viewer?.id,
  });

  const authors = new Map((await Promise.all([...new Set(posts.map((p) => p.authorId))].map(getUser)))
    .filter((u): u is NonNullable<typeof u> => u !== null)
    .map((u) => [u.id, u]));

  return NextResponse.json({
    posts: posts.map((p) => ({ ...p, author: authors.get(p.authorId) ?? null })),
    hasMore,
  });
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "登录后才能发帖" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  const content = String(body?.content ?? "").trim();
  if (!title || !content) return NextResponse.json({ error: "标题和内容都要填" }, { status: 400 });

  const number = await createPost({
    authorId: me.id,
    title: title.slice(0, 120),
    content: content.slice(0, 5000),
    images: Array.isArray(body?.images) ? body.images.slice(0, 4) : undefined,
    topics: Array.isArray(body?.topics) ? body.topics.filter((t: unknown) => typeof t === "string") : [],
    kind: String(body?.kind ?? "post"),
  });
  return NextResponse.json({ number });
}
