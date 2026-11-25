import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createComment, getPost } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "登录后才能评论" }, { status: 401 });

  const { number } = await params;
  const post = await getPost(Number(number));
  if (!post) return NextResponse.json({ error: "帖子不存在" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const content = String(body?.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "评论不能为空" }, { status: 400 });

  const parentId = typeof body?.parentId === "string" && body.parentId ? body.parentId : undefined;
  const id = `c-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  await createComment({
    id,
    postNumber: post.number,
    authorId: me.id,
    parentId,
    content: content.slice(0, 1000),
  });
  return NextResponse.json({ ok: true, id });
}
