"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  Briefcase,
  Coffee,
  Cpu,
  FlaskConical,
  Home,
  LogIn,
  Menu,
  MessageCircle,
  Plus,
  Rocket,
  Trophy,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TOPICS } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { LoginDialog } from "@/components/forum/login-dialog";
import { campusMeta } from "@/lib/campus/registry";
import { PublishDialog } from "@/components/forum/publish-dialog";

const TOPIC_ICONS: Record<string, LucideIcon> = {
  BookOpen,
  FlaskConical,
  Trophy,
  Briefcase,
  Cpu,
  Wrench,
  Rocket,
  Coffee,
};

function SidebarContent({
  pathname,
  onNavigate,
  unread,
}: {
  pathname: string;
  onNavigate?: () => void;
  unread: number;
}) {
  const { me } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      <nav className="flex flex-col gap-0.5">
        <NavItem href="/" icon={Home} label="首页" active={pathname === "/"} onNavigate={onNavigate} />
        <NavItem
          href="/campus"
          icon={BookOpen}
          label={campusMeta().name}
          active={pathname === "/campus"}
          onNavigate={onNavigate}
        />
        <NavItem
          href="/notifications"
          icon={Bell}
          label="通知"
          active={pathname === "/notifications"}
          onNavigate={onNavigate}
          badge={unread}
        />
      </nav>

      <div className="mt-5 px-2.5 text-xs font-medium text-muted-foreground">话题</div>
      <nav className="mt-1 flex flex-col gap-0.5">
        {TOPICS.map((t) => {
          const Icon = TOPIC_ICONS[t.icon] ?? Coffee;
          return (
            <NavItem
              key={t.slug}
              href={`/topics/${t.slug}`}
              icon={Icon}
              label={t.name}
              active={pathname === `/topics/${t.slug}`}
              onNavigate={onNavigate}
            />
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        {process.env.NEXT_PUBLIC_QQ_GROUP_URL && (
          <a
            href={process.env.NEXT_PUBLIC_QQ_GROUP_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/90 transition-colors hover:bg-accent"
          >
            <Users className="size-4 text-muted-foreground" />
            QQ 群
          </a>
        )}
        {me ? (
          <Link
            href="/me"
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-xl border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <span className="text-base leading-none">{me.avatar}</span>
            <span className="truncate">{me.name}</span>
          </Link>
        ) : (
          <Button
            variant="outline"
            size="lg"
            className="h-10 w-full rounded-xl text-sm"
            onClick={() => setLoginOpen(true)}
          >
            <LogIn className="size-4" /> 登录
          </Button>
        )}
      </div>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  onNavigate,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onNavigate?: () => void;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
        active ? "bg-accent font-medium text-foreground" : "text-foreground/90 hover:bg-accent",
      )}
    >
      <Icon className={cn("size-4", active ? "text-foreground" : "text-muted-foreground")} />
      <span className="flex-1 truncate">{label}</span>
      {badge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { me, loaded } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);

  // 通知红点：登录态下定时轮询
  useEffect(() => {
    if (!me) {
      setUnread(0);
      return;
    }
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/notifications?count_only=1", { cache: "no-store" });
        if (res.ok && !stop) setUnread((await res.json()).unread ?? 0);
      } catch {
        /* 忽略 */
      }
    };
    poll();
    const t = setInterval(poll, 60_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [me, pathname]);

  return (
    <>
      {/* 移动端顶栏 */}
      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex size-9 items-center justify-center rounded-lg hover:bg-accent"
          aria-label="打开菜单"
        >
          <Menu className="size-5" />
        </button>
        <Link href="/" className="flex items-center gap-1.5 font-bold">
          <span className="text-base">🎓</span> JLUAI
        </Link>
        <Link
          href="/notifications"
          className="relative ml-auto flex size-9 items-center justify-center rounded-lg hover:bg-accent"
          aria-label="通知"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </header>

      {/* 桌面端固定侧栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background/95 px-4 py-5 lg:flex">
        <Link href="/" className="mb-5 flex items-center gap-2.5 px-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-lg ring-1 ring-primary/20">
            🎓
          </span>
          <span className="text-lg font-bold tracking-tight">JLUAI</span>
        </Link>
        <Button
          size="lg"
          className="mb-4 h-10 w-full rounded-xl text-sm font-semibold"
          onClick={() => (me ? setPublishOpen(true) : setPublishOpen(true))}
        >
          <Plus className="size-4" /> 发布
        </Button>
        <SidebarContent pathname={pathname} unread={unread} />
      </aside>

      {/* 移动端抽屉 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-label="关闭菜单"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r bg-background px-4 py-5">
            <div className="mb-4 flex items-center justify-between px-2">
              <Link href="/" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-lg ring-1 ring-primary/20">
                  🎓
                </span>
                <span className="text-lg font-bold tracking-tight">JLUAI</span>
              </Link>
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg hover:bg-accent"
                aria-label="关闭"
              >
                <X className="size-5" />
              </button>
            </div>
            <Button
              size="lg"
              className="mb-4 h-10 w-full rounded-xl text-sm font-semibold"
              onClick={() => {
                setDrawerOpen(false);
                setPublishOpen(true);
              }}
            >
              <Plus className="size-4" /> 发布
            </Button>
            <SidebarContent
              pathname={pathname}
              unread={unread}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 移动端底部导航 */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-stretch border-t bg-background/95 backdrop-blur lg:hidden">
        <TabBarItem href="/" icon={Home} label="首页" active={pathname === "/"} />
        <TabBarItem href="/square" icon={Trophy} label="广场" active={pathname === "/square"} />
        <button
          onClick={() => setPublishOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 px-3 text-muted-foreground"
          aria-label="发布"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus className="size-4" />
          </span>
        </button>
        <TabBarItem href="/chat" icon={MessageCircle} label="聊天" active={pathname === "/chat"} />
        {loaded && me ? (
          <TabBarItem href="/me" icon={User} label="我的" active={pathname === "/me"} />
        ) : (
          <TabBarItem href="/campus" icon={BookOpen} label="地图" active={pathname === "/campus"} />
        )}
      </nav>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} />
    </>
  );
}

function TabBarItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
