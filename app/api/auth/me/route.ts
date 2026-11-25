import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: me.id, name: me.name, avatar: me.avatar, level: me.level } });
}
