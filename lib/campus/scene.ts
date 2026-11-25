"use client";

import * as Phaser from "phaser";
import {
  TILE,
  doorOf,
  solidBuildings,
  GENERIC_BOT_NAMES,
  GENERIC_BOT_LINES,
  type Building,
  type CampusPack,
} from "./types";
import { isSolid, type WorldBitmap, type FacadeSprite } from "./render";
import { buildCharacterTexture, LOOK_COUNT } from "./sprites";
import { resolveZones } from "./zones";
import { findPath, nearestFreeTile, tileToPixel, type TilePoint } from "./botpath";
import { hashString, seededRandom } from "@/lib/utils";
import { PIXEL_FONT_STACK } from "./font";

export type CampusSnapshot = {
  mode: "overview" | "walk";
  nearDoor: Building | null;
  onlineCount: number; // 真实在线 + 机器人
  onlineHumans: number; // 仅真实在线(含自己)
  place: string;
  clock: string;
};

export type CampusCallbacks = {
  onSnapshot?: (s: CampusSnapshot) => void;
  onOpenBuilding?: (b: Building) => void;
  onChatMessage?: (from: string, text: string) => void;
  onReady?: (scene: CampusGame) => void;
};

type Agent = {
  id: string;
  name: string;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  /** 逻辑坐标（渲染时再叠加呼吸起伏） */
  bx: number;
  by: number;
  phase: number;
  bubbleUntil: number;
  // 机器人 / 远程玩家
  bot?: boolean;
  waitUntil?: number;
  lastSay?: number;
  lastSayText?: string;
  // 寻路
  path?: TilePoint[];
  pathStep?: number;
  dest?: TilePoint;
  stuckSince?: number;
  lastX?: number;
  lastY?: number;
  // 远程插值
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  t?: number;
};

type LabelEntry = {
  text: Phaser.GameObjects.Text;
  tier: 0 | 1 | 2; // 0=地标 1=大建筑 2=其他
  facade: FacadeSprite;
};

const WALK_ZOOM = 3;
/** 总览/滚轮缩放档位，保证 nearest 缩放下像素对齐 */
const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export class CampusGame extends Phaser.Scene {
  private pack: CampusPack;
  private bm: WorldBitmap;
  private mode: "overview" | "walk" = "overview";
  private player!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private playerLabel!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private facing: 0 | 1 | 2 | 3 = 0;
  /** 玩家逻辑坐标（渲染坐标 = 逻辑 y - 呼吸偏移） */
  private px = 0;
  private py = 0;
  private agents = new Map<string, Agent>();
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private lampGlows: Phaser.GameObjects.Arc[] = [];
  private litImages: Phaser.GameObjects.Image[] = [];
  private interactHint: Building | null = null;
  private cb: CampusCallbacks;
  private myId: string;
  private myName: string;
  private mySay = "";
  private mySayUntil = 0;
  private nameVisible = true;
  private snapTimer = 0;
  private lodTimer = 0;
  private botRnd: () => number;
  private lastServerOnline = 1;
  private buildings: Building[];
  private botNames: string[];
  private botLines: string[];
  private botCount: number;
  /** 移动端虚拟摇杆输入(归一化 -1..1),无输入时为 (0,0) */
  private touchVec = { x: 0, y: 0 };
  private pinchDist: number | null = null;
  private labels: LabelEntry[] = [];
  private zoneLabels: Phaser.GameObjects.Text[] = [];
  private lastZoom = -1;
  private flagPairs: [Phaser.GameObjects.Image, Phaser.GameObjects.Image][] = [];
  private flagToggle = false;
  private sakuraTimer = 0;

  constructor(pack: CampusPack, cb: CampusCallbacks, myId: string, myName: string, bm: WorldBitmap) {
    super("campus");
    this.pack = pack;
    this.cb = cb;
    this.myId = myId;
    this.myName = myName;
    this.bm = bm;
    this.botRnd = seededRandom(hashString(myId) % 100000 + 7);
    this.buildings = solidBuildings(pack);
    this.botNames = pack.bots.names.length ? pack.bots.names : GENERIC_BOT_NAMES;
    this.botLines = pack.bots.lines.length ? pack.bots.lines : GENERIC_BOT_LINES;
    this.botCount = pack.bots.count ?? 24;
  }

  get worldW() {
    return this.pack.world.w;
  }

  get worldH() {
    return this.pack.world.h;
  }

  preload() {
    this.textures.addCanvas("world", this.bm.canvas);
    for (const f of this.bm.facades) {
      this.textures.addCanvas(f.key, f.canvas);
      if (f.litKey && f.litCanvas) this.textures.addCanvas(f.litKey, f.litCanvas);
    }
    for (const w of this.bm.waters) {
      this.textures.addCanvas(w.keyA, w.canvasA);
      this.textures.addCanvas(w.keyB, w.canvasB);
    }
    this.buildSmallTextures();
    // 小地图贴图
    const mini = document.createElement("canvas");
    mini.width = this.worldW;
    mini.height = this.worldH;
    const mctx = mini.getContext("2d")!;
    mctx.imageSmoothingEnabled = false;
    mctx.drawImage(this.bm.canvas, 0, 0, this.worldW, this.worldH);
    this.textures.addCanvas("minimap", mini);
    for (let i = 0; i < LOOK_COUNT; i++) {
      buildCharacterTexture(this, `char-${i}`, i);
    }
  }

  /** 程序化生成的动画用小贴图：花瓣、旗帜两帧 */
  private buildSmallTextures() {
    const petal = document.createElement("canvas");
    petal.width = 4;
    petal.height = 4;
    const pctx = petal.getContext("2d")!;
    pctx.fillStyle = "#f7cddd";
    pctx.fillRect(0, 1, 4, 2);
    pctx.fillRect(1, 0, 2, 4);
    this.textures.addCanvas("petal", petal);

    for (const [idx, wave] of [0, 1].entries()) {
      const f = document.createElement("canvas");
      f.width = 8;
      f.height = 7;
      const c = f.getContext("2d")!;
      c.fillStyle = idx === 0 ? "#d94a3d" : "#c0402f";
      for (let i = 0; i < 4; i++) {
        const hgt = wave === 0 ? 5 - i : 3 + (i % 2);
        c.fillRect(i * 2, 1, 2, hgt);
      }
      c.fillStyle = "#ffdf7a";
      c.fillRect(0, 0, 1, 1);
      this.textures.addCanvas(idx === 0 ? "flag-a" : "flag-b", f);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor("#4a5f3f");
    this.add.image(0, 0, "world").setOrigin(0, 0).setDepth(0);

    // 湖面：两帧波光交叉淡入淡出
    for (const w of this.bm.waters) {
      const a = this.add.image(w.x, w.y, w.keyA).setOrigin(0, 0).setDepth(1).setAlpha(1);
      const b = this.add.image(w.x, w.y, w.keyB).setOrigin(0, 0).setDepth(1).setAlpha(0);
      this.tweens.add({
        targets: a,
        alpha: { from: 1, to: 0 },
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.tweens.add({
        targets: b,
        alpha: { from: 0, to: 1 },
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // 樱花粒子
    this.spawnSakura();

    // 建筑 2.5D 立面：depth = footprint 底边 y
    for (const f of this.bm.facades) {
      this.add.image(f.x, f.y, f.key).setOrigin(0, 0).setDepth(f.depth);
      if (f.litKey) {
        const lit = this.add.image(f.x, f.y, f.litKey).setOrigin(0, 0).setDepth(f.depth + 0.5).setAlpha(0);
        this.litImages.push(lit);
      }
    }

    // 建筑名牌（LOD 由 updateLabelLod 控制）
    this.buildLabels();

    // 分区大字
    this.buildZoneLabels();

    // 校门旗帜两帧飘动
    for (const p of this.bm.flags) {
      const a = this.add.image(p.x, p.y, "flag-a").setOrigin(0, 0).setDepth(p.y + TILE);
      const b = this.add.image(p.x, p.y, "flag-b").setOrigin(0, 0).setDepth(p.y + TILE).setVisible(false);
      this.flagPairs.push([a, b]);
    }

    // 夜色遮罩与灯光(fillAlpha 必须为 1,整体浓度由 setAlpha 控制)
    this.nightOverlay = this.add
      .rectangle(0, 0, this.worldW * TILE, this.worldH * TILE, 0x0a1230)
      .setOrigin(0, 0)
      .setAlpha(0)
      .setDepth(900000);
    for (const l of this.bm.lampPositions) {
      const glow = this.add.circle(l.x, l.y - 8, 46, 0xffdf8a, 0.0);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setDepth(900001);
      this.lampGlows.push(glow);
    }

    // 玩家出生点
    const spawn = { x: (this.bm.spawn.x + 0.5) * TILE, y: (this.bm.spawn.y + 0.5) * TILE };
    this.px = spawn.x;
    this.py = spawn.y;
    this.playerShadow = this.add.ellipse(spawn.x, spawn.y, 12, 5, 0x1e2a1e, 0.28).setDepth(spawn.y - 0.5);
    this.player = this.add.sprite(spawn.x, spawn.y, "char-0", 0);
    this.player.setOrigin(0.5, 0.85);
    this.playerLabel = this.add
      .text(spawn.x, spawn.y - 26, this.myName, {
        fontFamily: PIXEL_FONT_STACK,
        fontSize: "12px",
        color: "#ffffff",
        stroke: "#00000099",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(spawn.y + 1);

    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,M,ESC",
    ) as Record<string, Phaser.Input.Keyboard.Key>;

    // 第二个触摸指针,供双指捏合缩放
    this.input.addPointer(1);

    // 按 M / Esc 在总览与行走间切换;空格与建筑/路牌交互
    this.input.keyboard!.on("keydown-M", () => this.toggleMode());
    this.input.keyboard!.on("keydown-ESC", () => {
      if (this.mode === "walk") this.enterOverview();
    });
    this.input.keyboard!.on("keydown-SPACE", () => {
      if (this.mode === "walk") this.tryInteract();
    });

    this.cameras.main.setBounds(0, 0, this.worldW * TILE, this.worldH * TILE);
    this.enterOverview();

    this.spawnBots();
    this.startPresenceLoop();
    this.cb.onReady?.(this);
    // 便于页面内调试/小地图访问
    (window as unknown as { __campusScene?: CampusGame }).__campusScene = this;

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.mode !== "overview") return;
      this.dragStart = { x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY };
      this.dragMoved = false;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.mode !== "overview") return;
      // 双指捏合缩放
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1?.isDown && p2?.isDown) {
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.pinchDist === null) {
          this.pinchDist = dist;
        } else if (this.pinchDist > 8) {
          this.zoomBy(dist / this.pinchDist);
          this.pinchDist = dist;
        }
        this.dragStart = null; // 双指时取消单指拖拽
        this.dragMoved = true;
        return;
      }
      if (!p.isDown || !this.dragStart) return;
      const cam = this.cameras.main;
      const dx = (p.x - this.dragStart.x) / cam.zoom;
      const dy = (p.y - this.dragStart.y) / cam.zoom;
      if (Math.hypot(p.x - this.dragStart.x, p.y - this.dragStart.y) > 6) this.dragMoved = true;
      cam.setScroll(this.dragStart.sx - dx, this.dragStart.sy - dy);
    });
    this.input.on("pointerup", () => {
      this.pinchDist = null;
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.mode !== "overview" || !this.dragStart) return;
      const moved = this.dragMoved;
      const start = this.dragStart;
      this.dragStart = null;
      if (moved) return;
      const cam = this.cameras.main;
      const tx = Math.floor((p.x / cam.zoom + start.sx) / TILE);
      const ty = Math.floor((p.y / cam.zoom + start.sy) / TILE);
      const b = this.buildings.find(
        (bb) => tx >= bb.x && tx < bb.x + bb.w && ty >= bb.y && ty < bb.y + bb.h,
      );
      if (b) this.cb.onOpenBuilding?.(b);
    });
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.mode === "overview") this.zoomBy(dy > 0 ? 1 / 1.12 : 1.12);
    });

    this.scale.on("resize", () => {
      if (this.mode === "overview") this.fitOverview();
    });
  }

  private dragStart: { x: number; y: number; sx: number; sy: number } | null = null;
  private dragMoved = false;

  // ---------- 名牌 / 分区 ----------
  private buildLabels() {
    for (const f of this.bm.facades) {
      if (!f.name) continue;
      const tier: 0 | 1 | 2 =
        f.category === "landmark" ? 0 : f.area >= 60 ? 1 : 2;
      const text = this.add
        .text(f.labelX, f.labelY, f.name, {
          fontFamily: PIXEL_FONT_STACK,
          fontSize: "12px",
          color: "#3d3a35",
          backgroundColor: "rgba(255,253,244,0.92)",
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 0.5)
        .setDepth(950000)
        .setVisible(false);
      text.setStroke("#0f0d0a", 2);
      this.labels.push({ text, tier, facade: f });
    }
  }

  private buildZoneLabels() {
    for (const z of resolveZones(this.pack)) {
      const t = this.add
        .text((z.x + z.w / 2) * TILE, (z.y + z.h / 2) * TILE, z.name, {
          fontFamily: PIXEL_FONT_STACK,
          fontSize: "22px",
          color: "#ffffff",
          stroke: "#1b2436",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(940000)
        .setAlpha(0)
        .setVisible(false);
      this.zoneLabels.push(t);
    }
  }

  /** 标签 LOD：按缩放与模式切换显示层级 */
  private updateLabelLod(now: number) {
    const cam = this.cameras.main;
    const zoomChanged = Math.abs(cam.zoom - this.lastZoom) > 0.01;
    if (!zoomChanged && this.mode !== "walk") return;
    if (this.mode === "walk" && now - this.lodTimer < 320) return;
    this.lodTimer = now;
    this.lastZoom = cam.zoom;

    const level: 0 | 1 | 2 = cam.zoom >= 1.15 ? 2 : cam.zoom >= 0.65 ? 1 : 0;
    const px = this.px;
    const py = this.py;
    for (const l of this.labels) {
      let vis = l.tier <= level;
      if (vis && this.mode === "walk") {
        const d = Math.hypot(l.facade.labelX - px, l.facade.labelY - py);
        vis = d < TILE * 15;
      }
      if (l.text.visible !== vis) l.text.setVisible(vis);
    }
    const zoneVisible = cam.zoom < 0.8;
    // 按 zoom 换字号，避免 setScale 二次模糊
    const zoneFontPx = Math.round(Phaser.Math.Clamp(18 / cam.zoom, 18, 48));
    for (const t of this.zoneLabels) {
      const target = zoneVisible ? Math.min(1, (0.8 - cam.zoom) * 4) : 0;
      if (target > 0) {
        t.setVisible(true);
        t.setAlpha(target);
        t.setScale(1);
        t.setFontSize(`${zoneFontPx}px`);
      } else if (t.visible) {
        t.setVisible(false);
      }
    }
  }

  // ---------- 樱花 ----------
  private spawnSakura() {
    const areas = [this.pack.decorations?.sakura, ...(this.pack.decorations?.sakuraAreas ?? [])].filter(
      (r): r is NonNullable<typeof r> => !!r,
    );
    for (const r of areas) {
      this.add
        .particles(r.x * TILE, r.y * TILE, "petal", {
          x: { min: 0, max: r.w * TILE },
          y: { min: 0, max: r.h * TILE },
          lifespan: 7000,
          speedY: { min: 8, max: 20 },
          speedX: { min: -10, max: 10 },
          rotate: { start: 0, end: 360 },
          alpha: { start: 0.95, end: 0.15 },
          scale: { min: 0.8, max: 1.4 },
          frequency: 260,
          quantity: 1,
          blendMode: "NORMAL",
        })
        .setDepth(700000);
    }
  }

  // ---------- 模式 ----------
  enterOverview() {
    this.mode = "overview";
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.removeBounds();
    this.fitOverview();
    this.lastZoom = -1;
    this.emitSnapshot();
  }

  fitOverview() {
    const cam = this.cameras.main;
    const fit = Math.min(
      this.scale.width / (this.worldW * TILE),
      (this.scale.height - 48) / (this.worldH * TILE),
    );
    // 提高下限：宁可拖拽看全貌，也不把细节压到不可读
    const zoom = Math.max(0.45, fit * 1.35);
    cam.setZoom(this.snapZoom(zoom));
    cam.centerOn((this.worldW * TILE) / 2, (this.worldH * TILE) / 2 + 24);
  }

  enterWalk() {
    this.mode = "walk";
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.worldW * TILE, this.worldH * TILE);
    cam.setZoom(WALK_ZOOM);
    cam.startFollow(this.player, true, 0.12, 0.12);
    this.lastZoom = -1;
    this.emitSnapshot();
  }

  toggleMode() {
    if (this.mode === "overview") this.enterWalk();
    else this.enterOverview();
  }

  centerOnMe() {
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(this.px, this.py, 350, "Sine.easeInOut");
    cam.once("camerapancomplete", () => cam.startFollow(this.player, true, 0.12, 0.12));
  }

  /** 小地图点击：跳到该处(总览模式下直接平移相机) */
  panToWorld(nx: number, ny: number) {
    if (this.mode !== "overview") this.enterOverview();
    const cam = this.cameras.main;
    cam.centerOn(nx * this.worldW * TILE, ny * this.worldH * TILE);
  }

  /** 吸附到最近的清晰缩放档 */
  private snapZoom(raw: number): number {
    const clamped = Phaser.Math.Clamp(raw, 0.25, 4);
    let best = ZOOM_STEPS[0];
    let bestDist = Math.abs(clamped - best);
    for (const step of ZOOM_STEPS) {
      const dist = Math.abs(clamped - step);
      if (dist < bestDist) {
        best = step;
        bestDist = dist;
      }
    }
    return best;
  }

  zoomBy(factor: number) {
    const cam = this.cameras.main;
    cam.setZoom(this.snapZoom(cam.zoom * factor));
  }

  setNameVisible(v: boolean) {
    this.nameVisible = v;
    this.playerLabel.setVisible(v && this.mode === "walk");
    for (const a of this.agents.values()) {
      a.label.setVisible(v);
    }
  }

  say(text: string) {
    this.mySay = text.slice(0, 60);
    this.mySayUntil = performance.now() + 4500;
    this.showBubble(this.player, this.mySay);
  }

  // ---------- 机器人 ----------
  private spawnBots() {
    const spots = this.pack.bots.spots;
    for (let i = 0; i < this.botCount; i++) {
      const name = this.botNames[i % this.botNames.length];
      const key = `char-${i % LOOK_COUNT}`;
      const base = spots.length
        ? spots[Math.floor(this.botRnd() * spots.length)]
        : { x: Math.floor(this.worldW / 2), y: Math.floor(this.worldH / 2) };
      // 落点可能被新标记的建筑占据,统一吸附到最近可走格
      // 加大 jitter 让同一点的多个机器人不重叠，再吸附到最近可走格
      const jitter = i === 0 ? { x: 0, y: 0 } : { x: Math.floor(this.botRnd() * 15) - 7, y: Math.floor(this.botRnd() * 11) - 5 };
      const tile =
        nearestFreeTile(this.bm.solid, this.worldW, this.worldH, base.x + jitter.x, base.y + jitter.y, 40) ?? base;
      const x = (tile.x + 0.5) * TILE;
      const y = (tile.y + 0.5) * TILE;
      const sprite = this.add.sprite(x, y, key, 0).setOrigin(0.5, 0.85);
      const shadow = this.add.ellipse(x, y, 12, 5, 0x1e2a1e, 0.28).setDepth(y - 0.5);
      const label = this.add
        .text(x, y - 26, name, {
          fontFamily: PIXEL_FONT_STACK,
          fontSize: "12px",
          color: "#ffffff",
          stroke: "#00000099",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(y + 1);
      const bot: Agent = {
        id: `bot-${i}`,
        name,
        sprite,
        shadow,
        label,
        bx: x,
        by: y,
        phase: this.botRnd() * 6.28,
        bubbleUntil: 0,
        bot: true,
        waitUntil: performance.now() + this.botRnd() * 3000,
      };
      this.agents.set(bot.id, bot);
    }
  }

  /** 选一个足够远的目标格并 BFS 寻路 */
  private repathBot(a: Agent) {
    const sx = Math.floor(a.bx / TILE);
    const sy = Math.floor(a.by / TILE);
    const spots = this.pack.bots.spots;
    for (let attempt = 0; attempt < 6; attempt++) {
      let dest: TilePoint | null = null;
      if (spots.length && attempt < 3) {
        const s = spots[Math.floor(this.botRnd() * spots.length)];
        dest = nearestFreeTile(this.bm.solid, this.worldW, this.worldH, s.x, s.y, 20);
      } else {
        const rx = sx + Math.floor(this.botRnd() * 51) - 25;
        const ry = sy + Math.floor(this.botRnd() * 41) - 20;
        dest = nearestFreeTile(this.bm.solid, this.worldW, this.worldH, rx, ry, 12);
      }
      if (!dest) continue;
      if (Math.hypot(dest.x - sx, dest.y - sy) < 6) continue;
      const path = findPath(this.bm.solid, this.worldW, this.worldH, { x: sx, y: sy }, dest);
      if (path && path.length) {
        a.path = path;
        a.pathStep = 0;
        a.dest = dest;
        a.stuckSince = 0;
        return true;
      }
    }
    a.path = undefined;
    a.waitUntil = performance.now() + 600 + this.botRnd() * 1400;
    return false;
  }

  // ---------- 联机 presence ----------
  private startPresenceLoop() {
    this.time.addEvent({
      delay: 380,
      loop: true,
      callback: () => {
        const now = performance.now();
        const sayActive = now < this.mySayUntil ? this.mySay : "";
        fetch("/api/presence", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: this.myId,
            name: this.myName,
            campus: this.pack.id, // 同校区才能互相看到
            x: Math.round(this.px),
            y: Math.round(this.py),
            dir: this.facing,
            say: sayActive,
          }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data) return;
            this.lastServerOnline = (data.online as number) ?? this.lastServerOnline;
            this.applyRemote(data.others as RemotePlayer[]);
            this.emitSnapshot();
          })
          .catch(() => {});
      },
    });
  }

  private applyRemote(list: RemotePlayer[]) {
    const now = performance.now();
    const seen = new Set<string>();
    for (const r of list) {
      if (!r || r.id === this.myId || r.id.startsWith("bot-")) continue;
      if (r.campus && r.campus !== this.pack.id) continue; // 别的校区不可见
      seen.add(r.id);
      let a = this.agents.get(r.id);
      if (!a) {
        const key = `char-${hashString(r.id) % LOOK_COUNT}`;
        const sprite = this.add.sprite(r.x, r.y, key, 0).setOrigin(0.5, 0.85);
        const shadow = this.add.ellipse(r.x, r.y, 12, 5, 0x1e2a1e, 0.28).setDepth(r.y - 0.5);
        const label = this.add
          .text(r.x, r.y - 26, r.name, {
            fontFamily: PIXEL_FONT_STACK,
            fontSize: "12px",
            color: "#ffe9a8",
            stroke: "#00000099",
            strokeThickness: 3,
          })
          .setOrigin(0.5, 1)
          .setDepth(r.y + 1);
        a = { id: r.id, name: r.name, sprite, shadow, label, bx: r.x, by: r.y, phase: 0, bubbleUntil: 0 };
        a.from = { x: r.x, y: r.y };
        a.to = { x: r.x, y: r.y };
        a.t = 1;
        this.agents.set(r.id, a);
      }
      a.from = { x: a.bx, y: a.by };
      a.to = { x: r.x, y: r.y };
      a.t = 0;
      if (r.say && a.lastSayText !== r.say) {
        a.lastSayText = r.say;
        a.bubbleUntil = now + 4500;
        this.showBubble(a.sprite, r.say);
        this.cb.onChatMessage?.(r.name, r.say);
      }
      const dir = (r.dir ?? 0) as 0 | 1 | 2 | 3;
      a.sprite.setFrame(this.frameFor(dir));
    }
    // 移除超时玩家
    for (const [id, a] of this.agents) {
      if (a.bot || seen.has(id)) continue;
      if (id === this.myId) continue;
      a.sprite.destroy();
      a.shadow.destroy();
      a.label.destroy();
      this.agents.delete(id);
    }
  }

  // ---------- 气泡 ----------
  private showBubble(target: Phaser.GameObjects.Sprite, text: string) {
    const width = Math.max(46, text.length * 11 + 14);
    const bg = this.add
      .rectangle(0, 0, width, 20, 0xffffff, 0.95)
      .setStrokeStyle(1, 0x2c2c30);
    const label = this.add
      .text(0, 0, text, {
        fontFamily: PIXEL_FONT_STACK,
        fontSize: "10px",
        color: "#222222",
      })
      .setOrigin(0.5, 0.5);
    const c = this.add
      .container(target.x, target.y - 40, [bg, label])
      .setDepth(1000000);
    const tail = this.add.triangle(target.x, target.y - 30, 0, 0, 12, 0, 6, 8, 0xffffff);
    tail.setDepth(1000000);
    this.time.delayedCall(4500, () => {
      c.destroy();
      tail.destroy();
    });
  }

  private frameFor(dir: 0 | 1 | 2 | 3): number {
    // 贴图布局:每行 2 帧(0:站立 1:走路),行序 down/up/left/right
    return dir * 2;
  }

  // ---------- 主循环 ----------
  override update(_time: number, delta: number) {
    const dt = delta / 1000;
    const now = performance.now();

    // 夜色:本地时间 18:30–6:00 夜,5:00/19:30 过渡
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    let darkness = 0;
    if (hour >= 19.5 || hour < 5) darkness = 0.52;
    else if (hour >= 18.3) darkness = 0.52 * ((hour - 18.3) / 1.2);
    else if (hour < 6.5) darkness = 0.52 * (1 - (hour - 5) / 1.5);
    this.nightOverlay.setAlpha(darkness);
    const litAlpha = Math.min(1, darkness * 1.9);
    if (this.litImages.length && Math.abs(this.lastLitAlpha - litAlpha) > 0.01) {
      this.lastLitAlpha = litAlpha;
      for (const img of this.litImages) img.setAlpha(litAlpha);
    }
    // 路灯光晕:呼吸 + 偶发闪烁
    for (let i = 0; i < this.lampGlows.length; i++) {
      const g = this.lampGlows[i];
      if (darkness < 0.08) {
        if (g.alpha !== 0) g.setAlpha(0);
        continue;
      }
      const t = now / 1000;
      const pulse = 0.26 + 0.06 * Math.sin(t * 1.7 + i * 0.6);
      const flicker = Math.sin(t * 11 + i * 2.3) > 0.96 ? 0.45 : 1;
      g.setAlpha(pulse * flicker);
    }

    // 校门旗帜:两帧交替
    if (now - this.sakuraTimer > 480) {
      this.sakuraTimer = now;
      this.flagToggle = !this.flagToggle;
      for (const [a, b] of this.flagPairs) {
        a.setVisible(!this.flagToggle);
        b.setVisible(this.flagToggle);
      }
    }

    if (this.mode === "walk") {
      this.updatePlayer(dt, now);
      this.updateInteraction();
    } else {
      this.updatePlayerIdle(now);
    }
    this.updateBots(now, dt);
    this.updateAgentBubbles();
    this.updateLabelLod(now);

    this.snapTimer += delta;
    if (this.snapTimer > 500) {
      this.snapTimer = 0;
      this.emitSnapshot();
    }
  }

  private lastLitAlpha = -1;
  private walkTimer = 0;
  private walkToggle = false;

  /** 站立呼吸（整像素起伏） */
  private idleBob(now: number, phase: number): number {
    return Math.sin(now / 620 + phase) > 0 ? 1 : 0;
  }

  private updatePlayer(dt: number, now: number) {
    const k = this.keys;
    let vx = 0;
    let vy = 0;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1;
    if (k.S.isDown || k.DOWN.isDown) vy += 1;
    // 触屏摇杆(键盘未按下时生效,支持模拟量)
    if (vx === 0 && vy === 0 && (this.touchVec.x !== 0 || this.touchVec.y !== 0)) {
      vx = this.touchVec.x;
      vy = this.touchVec.y;
    }
    const speed = 92;
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const len = Math.max(1, Math.hypot(vx, vy));
      const analog = Math.min(1, Math.hypot(vx, vy)); // 摇杆推得越满走越快
      vx = (vx / len) * speed * dt * analog;
      vy = (vy / len) * speed * dt * analog;
      if (Math.abs(vy) > Math.abs(vx)) this.facing = vy < 0 ? 1 : 0;
      else this.facing = vx < 0 ? 2 : 3;
      this.moveWithCollision(vx, vy);
      // 行走帧交替
      this.walkTimer += dt * 1000;
      if (this.walkTimer > 160) {
        this.walkTimer = 0;
        this.walkToggle = !this.walkToggle;
      }
    } else {
      this.walkToggle = false;
    }
    this.player.setFrame(this.frameFor(this.facing) + (this.walkToggle ? 1 : 0));

    const bob = moving ? 0 : this.idleBob(now, 0);
    this.placePlayer(bob);
  }

  /** 把逻辑坐标渲染到精灵/影子/名牌 */
  private placePlayer(bob: number) {
    const rx = this.px;
    const ry = this.py - bob;
    this.player.setPosition(rx, ry);
    this.playerShadow.setPosition(rx, ry);
    this.player.setDepth(ry);
    this.playerShadow.setDepth(ry - 0.5);
    this.playerLabel.setPosition(rx, ry - 26);
    this.playerLabel.setDepth(ry + 1);
    this.playerLabel.setVisible(this.nameVisible && this.mode === "walk");
  }

  /** 总览模式下角色原地呼吸 */
  private updatePlayerIdle(now: number) {
    const bob = this.idleBob(now, 0);
    this.player.setFrame(this.frameFor(0));
    this.placePlayer(bob);
  }

  private moveWithCollision(vx: number, vy: number) {
    // 半宽 5px,脚部碰撞点在 y+1
    const tryX = this.px + vx;
    if (!this.collides(tryX, this.py)) this.px = tryX;
    const tryY = this.py + vy;
    if (!this.collides(this.px, tryY)) this.py = tryY;
  }

  private collides(px: number, py: number): boolean {
    const feetY = py + 1;
    const pts = [
      [px - 5, feetY],
      [px + 5, feetY],
      [px - 5, feetY - 8],
      [px + 5, feetY - 8],
    ];
    for (const [x, y] of pts) {
      if (isSolid(this.bm, Math.floor(x / TILE), Math.floor(y / TILE))) return true;
    }
    return false;
  }

  private updateInteraction() {
    const tx = Math.floor(this.px / TILE);
    const ty = Math.floor((this.py + 1) / TILE);
    let near: Building | null = null;
    let bestD = Infinity;
    for (const b of this.buildings) {
      const door = doorOf(b);
      const d = Math.hypot(door.x - tx, door.y - ty);
      if (d < 2.2 && d < bestD) {
        bestD = d;
        near = b;
      }
    }
    this.interactHint = near;
  }

  private updateBots(now: number, dt: number) {
    for (const a of this.agents.values()) {
      if (!a.bot) continue;
      if (a.waitUntil && a.waitUntil > now) {
        a.sprite.setFrame(this.frameFor(0));
        this.applyBob(a, now);
        continue;
      }
      if (!a.path || a.pathStep === undefined || a.pathStep >= a.path!.length) {
        if (!this.repathBot(a)) continue;
      }
      const step = a.path![a.pathStep!];
      const target = tileToPixel(step);
      const dx = target.x - a.bx;
      const dy = target.y - a.by;
      const dist = Math.hypot(dx, dy);
      if (dist < 3) {
        a.pathStep! += 1;
        if (a.pathStep! >= a.path!.length) {
          a.path = undefined;
          a.waitUntil = now + 900 + this.botRnd() * 3200;
          if (this.botRnd() > 0.72 && now - (a.lastSay ?? 0) > 20000) {
            a.lastSay = now;
            const line = this.botLines[Math.floor(this.botRnd() * this.botLines.length)];
            a.bubbleUntil = now + 4500;
            this.showBubble(a.sprite, line);
            this.cb.onChatMessage?.(a.name, line);
          }
        }
        this.applyBob(a, now);
        continue;
      }
      const speed = 34;
      const nx = a.bx + (dx / dist) * speed * dt;
      const ny = a.by + (dy / dist) * speed * dt;
      const before = { x: a.bx, y: a.by };
      if (!this.collides(nx, ny)) {
        a.bx = nx;
        a.by = ny;
      } else {
        // 被卡住（如远处玩家/地形变化）：立刻重算路径
        a.path = undefined;
        a.waitUntil = now + 300 + this.botRnd() * 600;
      }
      a.sprite.setFrame(
        this.frameFor(Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 1 : 0) : dx < 0 ? 2 : 3),
      );
      // 长时间原地不动也要重算
      if (a.lastX !== undefined && a.lastY !== undefined && Math.hypot(a.bx - a.lastX, a.by - a.lastY) < 0.6) {
        if (!a.stuckSince) a.stuckSince = now;
        else if (now - a.stuckSince > 1600) {
          a.path = undefined;
          a.stuckSince = 0;
        }
      } else {
        a.stuckSince = 0;
      }
      a.lastX = before.x;
      a.lastY = before.y;
      this.applyBob(a, now);
    }
  }

  private applyBob(a: Agent, now: number) {
    const bob = this.idleBob(now, a.phase);
    const y = a.by - bob;
    a.sprite.setPosition(a.bx, y);
    a.shadow.setPosition(a.bx, y);
    a.sprite.setDepth(y);
    a.shadow.setDepth(y - 0.5);
    a.label.setPosition(a.bx, y - 26);
    a.label.setDepth(y + 1);
    a.label.setVisible(this.nameVisible);
  }

  private updateAgentBubbles() {
    for (const a of this.agents.values()) {
      if (a.t !== undefined && a.to && a.from && a.t < 1) {
        a.t = Math.min(1, a.t + 0.35);
        a.bx = Phaser.Math.Linear(a.from.x, a.to.x, a.t);
        a.by = Phaser.Math.Linear(a.from.y, a.to.y, a.t);
        a.sprite.setPosition(a.bx, a.by);
        a.shadow.setPosition(a.bx, a.by);
        a.label.setPosition(a.bx, a.by - 26);
        a.sprite.setDepth(a.by);
        a.shadow.setDepth(a.by - 0.5);
      }
    }
  }

  // ---------- 快照(HUD 用)----------
  private emitSnapshot() {
    const now = new Date();
    const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    // 附近地标
    const tx = this.px / TILE;
    const ty = this.py / TILE;
    let place = this.pack.defaultPlace;
    let bestD = Infinity;
    for (const b of this.buildings) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const d = Math.hypot(cx - tx, cy - ty);
      if (d < bestD) {
        bestD = d;
        place = `${b.name || "无名建筑"}附近`;
      }
    }
    this.cb.onSnapshot?.({
      mode: this.mode,
      nearDoor: this.interactHint,
      onlineCount: this.lastServerOnline + this.botCount,
      onlineHumans: this.lastServerOnline,
      place,
      clock,
    });
  }

  /** 小地图数据：含当前相机视口框(归一化) */
  getMinimapInfo() {
    const cam = this.cameras.main;
    const worldPxW = this.worldW * TILE;
    const worldPxH = this.worldH * TILE;
    const viewW = Math.min(worldPxW, this.scale.width / cam.zoom);
    const viewH = Math.min(worldPxH, this.scale.height / cam.zoom);
    return {
      worldW: this.worldW,
      worldH: this.worldH,
      player: { x: this.px / TILE / this.worldW, y: this.py / TILE / this.worldH },
      agents: [...this.agents.values()].map((a) => ({
        x: a.sprite.x / TILE / this.worldW,
        y: a.sprite.y / TILE / this.worldH,
        bot: !!a.bot,
      })),
      view: {
        x: Phaser.Math.Clamp(cam.worldView.x / worldPxW, 0, 1),
        y: Phaser.Math.Clamp(cam.worldView.y / worldPxH, 0, 1),
        w: Phaser.Math.Clamp(viewW / worldPxW, 0, 1),
        h: Phaser.Math.Clamp(viewH / worldPxH, 0, 1),
      },
    };
  }

  /** 供移动端虚拟摇杆调用:传入归一化方向(-1..1),(0,0) 表示松开 */
  setJoystick(x: number, y: number) {
    this.touchVec.x = Phaser.Math.Clamp(x, -1, 1);
    this.touchVec.y = Phaser.Math.Clamp(y, -1, 1);
  }

  tryInteract() {
    if (this.interactHint) this.cb.onOpenBuilding?.(this.interactHint);
    else {
      // 与最近的机器人聊天
      let best: Agent | null = null;
      let bestD = 42;
      for (const a of this.agents.values()) {
        const d = Phaser.Math.Distance.Between(this.px, this.py, a.bx, a.by);
        if (d < bestD) {
          bestD = d;
          best = a;
        }
      }
      if (best) {
        const line = this.botLines[Math.floor(Math.random() * this.botLines.length)];
        best.bubbleUntil = performance.now() + 4500;
        this.showBubble(best.sprite, line);
        this.cb.onChatMessage?.(best.name, line);
      }
    }
  }

  isInOverview() {
    return this.mode === "overview";
  }
}

export type RemotePlayer = {
  id: string;
  name: string;
  campus?: string;
  x: number;
  y: number;
  dir?: number;
  say?: string;
};
