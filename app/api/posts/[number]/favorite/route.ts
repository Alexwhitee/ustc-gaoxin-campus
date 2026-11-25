import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPost, toggleFavorite } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "登录后才能收藏" }, { status: 401 });

  const { number } = await params;
  const post = await getPost(Number(number));
  if (!post) return NextResponse.json({ error: "帖子不存在" }, { status: 404 });

  const r = await toggleFavorite(post.number, me.id);
  return NextResponse.json(r);
}
