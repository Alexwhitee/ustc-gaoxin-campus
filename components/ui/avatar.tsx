import * as React from "react";
import { cn, hashString } from "@/lib/utils";

// 用 emoji + 底色画一个头像，data-uri SVG，避免外部图片依赖
const AVATAR_BG = ["#dbeafe", "#fce7f3", "#dcfce7", "#fef9c3", "#e0e2ff", "#ffedd5", "#ccfbf1", "#f3e8ff"];

export function Avatar({
  name,
  emoji,
  className,
}: {
  name: string;
  emoji?: string;
  className?: string;
}) {
  const bg = AVATAR_BG[hashString(name) % AVATAR_BG.length];
  const ch = emoji ?? name.slice(0, 1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="${bg}"/><text x="20" y="27" font-size="19" text-anchor="middle" font-family="'PingFang SC','Microsoft YaHei',sans-serif">${ch}</text></svg>`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt={name}
      className={cn("size-10 shrink-0 rounded-full object-cover", className)}
      loading="lazy"
    />
  );
}

export function LevelBadge({ level, className }: { level: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium leading-none",
        "bg-muted text-muted-foreground",
        className,
      )}
    >
      Lv{level}
    </span>
  );
}
