import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getUser, isFollowing, toggleFollow } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "登录后才能关注" }, { status: 401 });

  const { id } = await params;
  if (id === me.id) return NextResponse.json({ error: "不能关注自己" }, { status: 400 });
  const target = await getUser(id);
  if (!target) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const r = await toggleFollow(me.id, id);
  return NextResponse.json(r);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ following: false });
  const { id } = await params;
  return NextResponse.json({ following: await isFollowing(me.id, id) });
}
