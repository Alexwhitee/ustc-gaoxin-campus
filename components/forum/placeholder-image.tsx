"use client";

import { cn, seededRandom } from "@/lib/utils";

// 根据 seed 生成占位示意图（渐变 + emoji），不依赖外部图片
const FOOD_EMOJIS = ["🍜", "🍚", "☕", "🍰", "🍲", "🥟", "🍱", "🧋"];
const SCENE_EMOJIS = ["🏫", "🌸", "📖", "💻", "🏀", "🌻", "🚲", "🌳"];

export function PlaceholderImage({ seed, className }: { seed: number; className?: string }) {
  const rnd = seededRandom(seed + 1);
  const hue = Math.floor(rnd() * 360);
  const emojiList = seed % 2 === 0 ? FOOD_EMOJIS : SCENE_EMOJIS;
  const emoji = emojiList[Math.floor(rnd() * emojiList.length)];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,82%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},65%,68%)"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><text x="60" y="74" font-size="42" text-anchor="middle">${emoji}</text></svg>`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("size-full object-cover", className)}
    />
  );
}
