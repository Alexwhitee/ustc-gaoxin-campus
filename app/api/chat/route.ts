import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listChatMessages, sendChatMessage } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const after = Number(searchParams.get("after") ?? 0) || 0;
  const messages = await listChatMessages(after);
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "登录后才能聊天" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const content = String(body?.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "消息不能为空" }, { status: 400 });

  const id = await sendChatMessage(me.id, content.slice(0, 300));
  return NextResponse.json({ id });
}
