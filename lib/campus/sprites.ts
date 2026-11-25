// 程序化像素小人：4 方向 × 2 帧行走动画，16×18 每帧
// 全部代码绘制，不依赖外部素材

export type CharacterLook = {
  hair: string;
  shirt: string;
  pants: string;
  skin: string;
  bag?: string;
};

const LOOKS: CharacterLook[] = [
  { hair: "#2f2a26", shirt: "#5b79c7", pants: "#3c4450", skin: "#f2c9a4" },
  { hair: "#4a3120", shirt: "#d98f5a", pants: "#55606e", skin: "#f5d3b0" },
  { hair: "#1f1d1b", shirt: "#6aa87a", pants: "#40474f", skin: "#eab88f" },
  { hair: "#6b4b2a", shirt: "#c96a8f", pants: "#4d5560", skin: "#f2c9a4" },
  { hair: "#242424", shirt: "#8a7fc9", pants: "#3a4048", skin: "#f5d3b0", bag: "#c0574f" },
  { hair: "#3a2c20", shirt: "#e0c05a", pants: "#4a5260", skin: "#eab88f" },
  { hair: "#55341f", shirt: "#5fa8b8", pants: "#3d4450", skin: "#f2c9a4", bag: "#4f7a4a" },
  { hair: "#141210", shirt: "#c0c6cf", pants: "#454d59", skin: "#edbd94" },
];

function drawFrame(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  dir: 0 | 1 | 2 | 3, // 0 down, 1 up, 2 left, 3 right
  frame: 0 | 1,
  ox: number,
  oy: number,
) {
  const P = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x, oy + y, w, h);
  };
  const walk = frame === 1;
  const dark = "rgba(0,0,0,0.35)";

  // 头发+头（8x7）
  P(4, 1, 8, 3, look.hair);
  P(3, 3, 10, 4, look.hair);
  if (dir === 1) {
    // 背面：全是头发
    P(4, 4, 8, 3, look.hair);
  } else {
    // 脸
    P(4, 4, 8, 3, look.skin);
    // 眼睛
    if (dir === 0) {
      P(6, 5, 1, 1, "#2a2a2a");
      P(9, 5, 1, 1, "#2a2a2a");
    } else if (dir === 2) {
      P(5, 5, 1, 1, "#2a2a2a");
      P(7, 4, 1, 3, look.hair); // 侧脸刘海
    } else {
      P(10, 5, 1, 1, "#2a2a2a");
      P(8, 4, 1, 3, look.hair);
    }
  }

  // 身体（8x6）
  P(4, 7, 8, 6, look.shirt);
  P(4, 7, 8, 1, dark);
  // 手臂
  if (dir === 2) {
    P(3, 8, 1, 4, look.shirt);
  } else if (dir === 3) {
    P(12, 8, 1, 4, look.shirt);
  } else {
    P(3, 8, 1, 4, look.shirt);
    P(12, 8, 1, 4, look.shirt);
  }
  // 书包
  if (look.bag) {
    if (dir === 1) P(5, 8, 6, 4, look.bag);
    else if (dir === 2) P(10, 8, 3, 4, look.bag);
    else if (dir === 3) P(3, 8, 3, 4, look.bag);
  }

  // 腿（走路两帧交替）
  P(5, 13, 2, 3, look.pants);
  P(9, 13, 2, 3, look.pants);
  if (walk) {
    if (dir === 2 || dir === 3) {
      P(6, 13, 2, 4, look.pants);
      P(8, 13, 2, 2, look.pants);
    } else {
      P(4, 13, 2, 4, look.pants);
      P(10, 13, 2, 2, look.pants);
    }
  }
  // 鞋
  P(5, 16, 2, 1, "#2c2c30");
  P(9, 16, 2, 1, "#2c2c30");
  if (walk) {
    if (dir === 2 || dir === 3) {
      P(6, 17, 2, 1, "#2c2c30");
      P(8, 15, 2, 1, "#2c2c30");
    } else {
      P(4, 17, 2, 1, "#2c2c30");
      P(10, 15, 2, 1, "#2c2c30");
    }
  }
}

const FW = 16;
const FH = 18;

export function buildCharacterTexture(
  scene: Phaser.Scene,
  key: string,
  lookIndex: number,
): void {
  const look = LOOKS[lookIndex % LOOKS.length];
  const canvas = document.createElement("canvas");
  canvas.width = FW * 2;
  canvas.height = FH * 4;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const dirs: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];
  dirs.forEach((d, row) => {
    drawFrame(ctx, look, d, 0, 0, row * FH);
    drawFrame(ctx, look, d, 1, FW, row * FH);
  });
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  // 把 2×4 格 sheet 切成帧 0..7，否则精灵会显示整张图（看起来像八人叠在一起）
  const texture = scene.textures.get(key);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      texture.add(row * 2 + col, 0, col * FW, row * FH, FW, FH);
    }
  }
  // 不建全局动画：行走帧由场景按朝向手动交替（站立帧 + 走路帧）
}

export const LOOK_COUNT = LOOKS.length;

// 机器人昵称与台词按校园包配置(见 types.ts 的 CampusBots),此处不再内置。
