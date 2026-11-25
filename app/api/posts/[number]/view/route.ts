import { NextResponse } from "next/server";
import { getPost, incrementViews } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** 浏览计数：客户端首次挂载时调用一次（配合 sessionStorage 防重复） */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const post = await getPost(Number(number));
  if (!post) return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  await incrementViews(post.number);
  return NextResponse.json({ ok: true });
}
