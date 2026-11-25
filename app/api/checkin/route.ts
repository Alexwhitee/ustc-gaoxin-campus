import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkin, checkinStatus } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ checkedToday: false, streak: 0 });
  return NextResponse.json(await checkinStatus(me.id));
}

export async function POST() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "登录后才能签到" }, { status: 401 });
  const r = await checkin(me.id);
  if (!r.ok) return NextResponse.json({ error: "今天已经签到过了", ...r }, { status: 409 });
  return NextResponse.json(r);
}
