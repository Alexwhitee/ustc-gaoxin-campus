import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPost, getUser, listComments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const viewer = await getSessionUser();
  const post = await getPost(Number(number), viewer?.id);
  if (!post) return NextResponse.json({ error: "帖子不存在" }, { status: 404 });

  const author = await getUser(post.authorId);
  const comments = await listComments(post.number);
  return NextResponse.json({ post, author, comments });
}
