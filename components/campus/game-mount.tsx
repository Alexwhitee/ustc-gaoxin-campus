"use client";

import { useEffect, useRef, useState } from "react";
import * as Phaser from "phaser";
import { CampusGame, type CampusCallbacks, type CampusSnapshot } from "@/lib/campus/scene";
import { loadCampusPack } from "@/lib/campus/registry";
import { renderWorldAsync, type RenderProgress, type WorldBitmap } from "@/lib/campus/render";
import { ensurePixelFontReady } from "@/lib/campus/font";
import type { Building, CampusPack } from "@/lib/campus/types";

export type MountProps = {
  myId: string;
  myName: string;
  pack?: CampusPack;
  onReady: (g: CampusGame) => void;
  onSnapshot: (s: CampusSnapshot) => void;
  onOpenBuilding: (b: Building) => void;
  onChatMessage: (from: string, text: string) => void;
};

export default function GameMount({
  myId,
  myName,
  pack: givenPack,
  onReady,
  onSnapshot,
  onOpenBuilding,
  onChatMessage,
}: MountProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [phase, setPhase] = useState<"pack" | "render" | "boot" | "ready">("pack");
  const [progress, setProgress] = useState<RenderProgress>({ percent: 0, label: "拉取校园数据" });
  const [bootError, setBootError] = useState<string | null>(null);
  const cbRef = useRef<CampusCallbacks>({ onSnapshot, onOpenBuilding, onChatMessage, onReady });
  cbRef.current = { onSnapshot, onOpenBuilding, onChatMessage, onReady };

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    const aborted = { aborted: false };
    let teardown: (() => void) | undefined;

    const run = async () => {
      try {
        const pack =
          givenPack ??
          (await (async () => {
            setProgress({ percent: 0, label: "拉取校园数据" });
            return loadCampusPack();
          })());
        if (aborted.aborted) return;

        setPhase("render");
        setProgress({ percent: 0.02, label: "准备像素字体" });
        await ensurePixelFontReady();
        if (aborted.aborted) return;

        let world: WorldBitmap | null = null;
        try {
          world = await renderWorldAsync(
            pack,
            (p) => !aborted.aborted && setProgress(p),
            aborted,
          );
        } catch (e) {
          if (aborted.aborted) return;
          throw e;
        }
        if (aborted.aborted || !world) return;

        setPhase("boot");
        setProgress({ percent: 1, label: "进入校园" });
        // 让进度条完成一次绘制后再创建 WebGL 上下文
        // (后台标签页 rAF 会被暂停,与 setTimeout 竞速避免永久卡住)
        await new Promise((r) => {
          const t = setTimeout(() => r(null), 100);
          requestAnimationFrame(() => {
            clearTimeout(t);
            r(null);
          });
        });

        const onErr = (e: ErrorEvent) => {
          setBootError(`${e.message}\n${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack ?? ""}`);
        };
        const onRej = (e: PromiseRejectionEvent) => {
          setBootError(`rejection: ${String(e.reason?.stack ?? e.reason)}`);
        };
        window.addEventListener("error", onErr);
        window.addEventListener("unhandledrejection", onRej);

        const scene = new CampusGame(pack, cbRef.current, myId, myName, world);
        const game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: hostRef.current!,
          pixelArt: true,
          roundPixels: true,
          antialias: false,
          backgroundColor: "#4a5f3f",
          // 用 setTimeout 驱动主循环:rAF 在后台标签页会被浏览器暂停,
          // 导致「加载完成后场景永远不挂起」(卡在 100%);后台时浏览器会自动节流
          fps: { forceSetTimeOut: true },
          scale: {
            mode: Phaser.Scale.RESIZE,
            width: "100%",
            height: "100%",
          },
          scene,
        });
        gameRef.current = game;
        setPhase("ready");

        teardown = () => {
          window.removeEventListener("error", onErr);
          window.removeEventListener("unhandledrejection", onRej);
        };
      } catch (e) {
        setBootError(String((e as Error)?.stack ?? e));
      }
    };

    void run();
    return () => {
      aborted.aborted = true;
      teardown?.();
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.round(progress.percent * 100);
  return (
    <>
      <div ref={hostRef} className="h-full w-full" />
      {phase !== "ready" && !bootError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#151b30] px-8 text-white">
          <div className="pixel-font text-base tracking-widest">{progress.label}…</div>
          <div className="h-3 w-64 max-w-[70vw] border-2 border-amber-200/70 bg-black/50 p-0.5">
            <div
              className="h-full bg-amber-300 transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="pixel-font text-xs text-white/70 tabular-nums">
            {phase === "pack" ? "校园包加载中" : `${pct}%`}
          </div>
        </div>
      )}
      {bootError && (
        <pre className="absolute inset-x-4 bottom-4 z-50 max-h-56 overflow-auto rounded bg-black/85 p-3 text-[11px] leading-4 text-red-300">
          {bootError}
        </pre>
      )}
    </>
  );
}
