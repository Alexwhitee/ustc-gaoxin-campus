"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Minus, Plus, X } from "lucide-react";
import type { CampusGame, CampusSnapshot } from "@/lib/campus/scene";
import { CATEGORY_INFO, type Building } from "@/lib/campus/types";
import { listCampuses, switchCampus, loadCampusPack } from "@/lib/campus/registry";
import { hashString, seededRandom } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { VirtualJoystick } from "@/components/campus/joystick";
import { LoginDialog } from "@/components/forum/login-dialog";
import type { CampusPack } from "@/lib/campus/types";

const GameMount = dynamic(() => import("./game-mount"), {
  ssr: false,
  loading: () => null,
});

// 伪天气：按日期生成稳定的演示数据（原站接的是实时天气）
function pseudoWeather(winterBase: number, shoulderBase: number, summerBase: number) {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const rnd = seededRandom(seed);
  const kinds = ["晴", "多云", "阴", "小雨"] as const;
  const kind = kinds[Math.floor(rnd() * kinds.length)];
  const month = d.getMonth() + 1;
  const base =
    month <= 3 || month >= 11 ? winterBase : month <= 5 || month >= 9 ? shoulderBase : summerBase;
  const temp = Math.round(base + rnd() * 12);
  const wind = 1 + Math.floor(rnd() * 3);
  return { kind, temp, wind };
}

const WALK_HINT =
  "方向键或 WASD 走动，空格查看楼门口与路牌、和人说话；M 或 Esc 回总览";

export default function CampusHud() {
  const [pack, setPack] = useState<CampusPack | null>(null);
  const campuses = useMemo(() => listCampuses(), []);
  const gameRef = useRef<CampusGame | null>(null);
  const [snap, setSnap] = useState<CampusSnapshot | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nameVisible, setNameVisible] = useState(true);
  const [chatLog, setChatLog] = useState<{ name: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const { me: meState } = useAuth();
  // 每次页面加载生成独立 id：旧 id 在 presence 服务器 6 秒后过期，语义等同重新上线
  const [tabId] = useState(
    () => `tab-${Math.random().toString(36).slice(2, 10)}`,
  );

  // 校园包按 ?campus= 懒加载，USTC 数据不再进入首屏 bundle
  useEffect(() => {
    let alive = true;
    loadCampusPack().then((p) => alive && setPack(p));
    return () => {
      alive = false;
    };
  }, []);

  const weather = useMemo(
    () => (pack ? pseudoWeather(pack.weather.winterBase, pack.weather.shoulderBase, pack.weather.summerBase) : null),
    [pack],
  );
  // 触屏设备：显示虚拟摇杆与交互按钮
  const isTouch = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
    [],
  );

  const onSnapshot = useCallback((s: CampusSnapshot) => setSnap(s), []);
  const onOpenBuilding = useCallback((b: Building) => {
    const info = CATEGORY_INFO[b.category];
    const line = info.lines[hashString(b.id) % info.lines.length];
    // 不变异场景共享的 Building 对象，flavor 只放进本组件状态
    setBuilding({ ...b, flavor: line } as Building & { flavor: string });
  }, []);
  const onChatMessage = useCallback((from: string, text: string) => {
    setChatLog((prev) => [...prev.slice(-40), { name: from, text }]);
  }, []);

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatLog((prev) => [...prev.slice(-40), { name: meState?.name ?? "我", text }]);
    gameRef.current?.say(text);
    setChatInput("");
  };

  const online = snap?.onlineCount ?? 0;
  const isWalk = snap?.mode === "walk";

  return (
    <div className="relative h-[100dvh] w-full select-none overflow-hidden bg-[#1a2038]">
      <div className="absolute inset-0">
        {pack && (
          <GameMount
            pack={pack}
            onReady={(g) => (gameRef.current = g)}
            myId={tabId || "anonymous"}
            myName={meState?.name ?? "游客"}
            onSnapshot={onSnapshot}
            onOpenBuilding={onOpenBuilding}
            onChatMessage={onChatMessage}
          />
        )}
      </div>

      {/* ===== 总览模式 UI ===== */}
      {pack && !isWalk && (
        <>
          <header className="absolute inset-x-0 top-0 flex items-center gap-3 bg-[#151b30]/95 px-4 py-2 text-white">
            <div className="min-w-0">
              <div className="pixel-font truncate text-sm">{pack.name}</div>
              <div className="truncate text-[11px] text-white/60">{pack.subtitle}</div>
            </div>
            <select
              value={pack.id}
              onChange={(e) => switchCampus(e.target.value)}
              className="pixel-font ml-2 rounded bg-white/10 px-1.5 py-1 text-xs text-white outline-none hover:bg-white/20"
              aria-label="切换校园"
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id} className="text-black">
                  {c.name}
                </option>
              ))}
            </select>
            {pack.id === "ustc-gaoxin" && (
              <>
                <a
                  href="/gaoxin-3d/index.html"
                  className="shrink-0 rounded bg-amber-300 px-2 py-1 text-xs text-amber-950 hover:bg-amber-200"
                >
                  3D 漫游
                </a>
                <a
                  href="/gaoxin-walk/index.html"
                  className="hidden shrink-0 rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20 sm:inline"
                >
                  等距漫游
                </a>
              </>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => gameRef.current?.zoomBy(1 / 1.25)}
                className="flex size-7 items-center justify-center rounded-none bg-white/10 hover:bg-white/20"
                aria-label="缩小"
              >
                <Minus className="size-3.5" />
              </button>
              <button
                onClick={() => gameRef.current?.zoomBy(1.25)}
                className="flex size-7 items-center justify-center rounded-none bg-white/10 hover:bg-white/20"
                aria-label="放大"
              >
                <Plus className="size-3.5" />
              </button>
              <button
                onClick={() => gameRef.current?.centerOnMe()}
                className="pixel-font rounded-none bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20"
              >
                回到自己
              </button>
            </div>
          </header>

          {/* 总览也有小地图：点击可直接跳到该处 */}
          <div className="absolute bottom-16 right-3 z-10 flex flex-col items-end gap-1.5">
            <div className="overflow-hidden border-2 border-black/60">
              <MiniMap gameRef={gameRef} aspect={pack.world.h / pack.world.w} />
            </div>
            <span className="text-[10px] text-white/50">点小地图跳转</span>
          </div>

          <button
            onClick={() => gameRef.current?.enterWalk()}
            className="pixel-border pixel-font absolute bottom-16 left-1/2 -translate-x-1/2 bg-amber-300 px-10 py-2.5 text-lg text-amber-950 transition-transform hover:scale-105"
          >
            进去逛逛
          </button>

          <p className="absolute bottom-8 left-4 text-xs text-white/60">
            点击某处看楼名字；拖动平移，滚轮缩放，M 或 Esc 进去逛逛
          </p>
          <p className="absolute bottom-2 left-4 text-[11px] text-white/40">{pack.credit}</p>
        </>
      )}

      {/* ===== 行走模式 UI ===== */}
      {pack && isWalk && (
        <>
          {/* 触屏：虚拟摇杆 + 交互按钮（聊天面板打开时隐藏避免遮挡） */}
          {isTouch && !chatOpen && (
            <>
              <div className="absolute bottom-6 left-5 z-10">
                <VirtualJoystick onMove={(x, y) => gameRef.current?.setJoystick(x, y)} />
              </div>
              <button
                onClick={() => gameRef.current?.tryInteract()}
                className="pixel-border absolute bottom-24 right-6 z-10 flex size-16 touch-none items-center justify-center bg-black/60 text-xs text-white active:bg-black/80"
              >
                交互
              </button>
              <button
                onClick={() => gameRef.current?.enterOverview()}
                className="pixel-border absolute bottom-6 right-6 z-10 flex size-14 touch-none items-center justify-center bg-black/60 text-xs text-white active:bg-black/80"
              >
                地图
              </button>
            </>
          )}
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className="pixel-font rounded-none bg-black/60 px-2.5 py-1 text-[11px] text-white/90">
              {meState ? `欢迎，${meState.name}` : "以游客身份浏览，登录后大家能看到你的昵称"}
            </span>
            <span className="pixel-font rounded-none bg-black/60 px-2.5 py-1 text-[11px] text-white/90 tabular-nums">
              真实 {snap?.onlineHumans ?? 1} 人 + 机器人 {online - (snap?.onlineHumans ?? 1)}
            </span>
            {!meState && (
              <button
                onClick={() => setLoginOpen(true)}
                className="pixel-font rounded-none bg-amber-300 px-2.5 py-1 text-[11px] text-amber-950 hover:bg-amber-200"
              >
                登录
              </button>
            )}
            {process.env.NEXT_PUBLIC_QQ_GROUP_URL && (
              <a
                href={process.env.NEXT_PUBLIC_QQ_GROUP_URL}
                target="_blank"
                rel="noreferrer"
                className="pixel-font rounded-none bg-amber-300 px-2.5 py-1 text-[11px] text-amber-950 hover:bg-amber-200"
              >
                QQ 群
              </a>
            )}
          </div>

          {/* 右上：聊天按钮 + 小地图 + 天气 + 设置 */}
          <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
            <button
              onClick={() => setChatOpen((v) => !v)}
              className="pixel-font flex items-center gap-1.5 rounded-none bg-black/60 px-2.5 py-1.5 text-xs text-white hover:bg-black/70"
            >
              <MessageSquare className="size-3.5" /> 聊天
            </button>
            <button
              className="border-2 border-black/60"
              onClick={() => gameRef.current?.centerOnMe()}
              aria-label="定位到自己"
            >
              <MiniMap gameRef={gameRef} aspect={pack.world.h / pack.world.w} />
            </button>
            <div className="pixel-font rounded-none bg-black/60 px-2.5 py-1.5 text-right text-[11px] leading-4 text-white">
              <div>
                {snap?.place ?? pack.defaultPlace}
              </div>
              <div className="tabular-nums text-white/80">
                {snap?.clock ?? "--:--"} {weather?.kind} {weather?.temp}°C
              </div>
              <div className="text-white/50">南风 {weather?.wind} 级</div>
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="pixel-font rounded-none bg-black/60 px-2.5 py-1.5 text-xs text-white hover:bg-black/70"
            >
              设置
            </button>
          </div>

          {/* 底部交互提示 */}
          <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 px-16 text-center">
            {snap?.nearDoor && (
              <div className="pixel-border mb-2 inline-block bg-black/80 px-3 py-1.5 text-sm text-white">
                {isTouch ? "点「交互」查看" : "空格"}「{snap.nearDoor.name}」
              </div>
            )}
            <div className="text-[11px] text-white/50">
              {isTouch
                ? "左侧摇杆走动，右侧「交互」看楼/聊天，「地图」回总览"
                : WALK_HINT}
            </div>
          </div>

          {/* 聊天抽屉 */}
          {chatOpen && (
            <div className="absolute bottom-3 right-3 flex w-72 flex-col rounded-none border border-white/10 bg-black/80 text-white shadow-xl">
              <div className="pixel-font flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs">
                <span>附近频道 · 第 1 组</span>
                <button onClick={() => setChatOpen(false)} aria-label="关闭聊天">
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="max-h-48 min-h-24 space-y-1.5 overflow-y-auto px-3 py-2 text-xs">
                {chatLog.length === 0 && (
                  <p className="py-4 text-center text-white/40">旁边的人还没有说话</p>
                )}
                {chatLog.map((m, i) => (
                  <p key={i}>
                    <span className="text-amber-300">{m.name}：</span>
                    {m.text}
                  </p>
                ))}
              </div>
              <div className="flex gap-1.5 border-t border-white/10 p-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="说点什么……"
                  className="min-w-0 flex-1 rounded-none bg-white/10 px-2 py-1 text-xs outline-none placeholder:text-white/40"
                />
                <button
                  onClick={sendChat}
                  className="pixel-font rounded-none bg-amber-300 px-2 py-1 text-xs text-amber-950"
                >
                  发送
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== 建筑信息卡 ===== */}
      {building && (
        <div className="absolute left-1/2 top-1/2 z-10 w-80 rounded-none border-2 border-black/70 bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="pixel-font text-base">{building.name}</h3>
              <p className="text-xs text-muted-foreground">
                {CATEGORY_INFO[building.category].label} · {building.floors} 层
              </p>
            </div>
            <button onClick={() => setBuilding(null)} aria-label="关闭">
              <X className="size-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-foreground/90">
            {(building as Building & { flavor?: string }).flavor}
          </p>
        </div>
      )}

      {/* ===== 设置 ===== */}
      {settingsOpen && (
        <div className="absolute right-3 top-3 z-10 w-60 rounded-none border-2 border-black/70 bg-white p-4 text-sm shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="pixel-font font-semibold">设置</h3>
            <button onClick={() => setSettingsOpen(false)} aria-label="关闭设置">
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
          <label className="mt-3 flex items-center justify-between">
            显示名字
            <input
              type="checkbox"
              checked={nameVisible}
              onChange={(e) => {
                setNameVisible(e.target.checked);
                gameRef.current?.setNameVisible(e.target.checked);
              }}
              className="accent-[hsl(var(--primary))]"
            />
          </label>
          <button
            onClick={() => gameRef.current?.enterOverview()}
            className="pixel-font mt-3 w-full rounded-none bg-muted px-3 py-1.5 text-xs hover:bg-accent"
          >
            回到总览地图
          </button>
          <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
            {WALK_HINT}
          </p>
        </div>
      )}

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}

function MiniMap({
  gameRef,
  aspect,
}: {
  gameRef: React.RefObject<CampusGame | null>;
  aspect: number; // 世界高宽比,画布按此推导
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 500) return;
      last = t;
      const g = gameRef.current;
      const cv = ref.current;
      if (!g || !cv) return;
      const ctx = cv.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      // CampusGame 是 Phaser.Scene：textures 挂在场景自身上
      const scene = g as unknown as {
        textures?: { get: (k: string) => { getSourceImage: () => CanvasImageSource | undefined } | undefined };
      };
      const worldTex = scene.textures?.get("minimap")?.getSourceImage();
      if (!worldTex) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(worldTex, 0, 0, cv.width, cv.height);
      const info = g.getMinimapInfo();
      for (const a of info.agents) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(a.x * cv.width, a.y * cv.height, 2, 2);
      }
      // 当前相机视口框
      const v = info.view;
      ctx.strokeStyle = "#ffdf8a";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.round(v.x * cv.width) + 0.5,
        Math.round(v.y * cv.height) + 0.5,
        Math.max(2, Math.round(v.w * cv.width)),
        Math.max(2, Math.round(v.h * cv.height)),
      );
      ctx.fillStyle = "#ff4d4f";
      ctx.fillRect(info.player.x * cv.width - 1.5, info.player.y * cv.height - 1.5, 4, 4);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [gameRef]);
  return (
    <canvas
      ref={ref}
      width={150}
      height={Math.round(150 * aspect)}
      className="block cursor-pointer"
      onPointerDown={(e) => {
        const cv = ref.current;
        const g = gameRef.current;
        if (!cv || !g) return;
        const rect = cv.getBoundingClientRect();
        const nx = PhaserClamp((e.clientX - rect.left) / rect.width);
        const ny = PhaserClamp((e.clientY - rect.top) / rect.height);
        g.panToWorld(nx, ny);
      }}
    />
  );
}

function PhaserClamp(v: number) {
  return Math.max(0, Math.min(1, v));
}
