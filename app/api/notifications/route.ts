import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listNotifications, markAllNotificationsRead, unreadCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ notifications: [], unread: 0 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("count_only") === "1") {
    return NextResponse.json({ unread: await unreadCount(me.id) });
  }
  return NextResponse.json({
    notifications: await listNotifications(me.id),
    unread: await unreadCount(me.id),
  });
}

export async function POST() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "未登录" }, { status: 401 });
  await markAllNotificationsRead(me.id);
  return NextResponse.json({ ok: true });
}
