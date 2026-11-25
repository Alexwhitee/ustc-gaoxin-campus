"use client";

import { useEffect } from "react";

/** 浏览计数：每个会话每篇帖子只计一次 */
export function ViewCounter({ postNumber }: { postNumber: number }) {
  useEffect(() => {
    const key = `jluai-viewed-${postNumber}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // 隐私模式下 sessionStorage 可能不可用，仍然计数
    }
    fetch(`/api/posts/${postNumber}/view`, { method: "POST" }).catch(() => {});
  }, [postNumber]);
  return null;
}
