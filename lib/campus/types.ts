// 校园包(campus pack)类型定义:每个校园一份声明式数据,
// 渲染器(render.ts)与玩法场景(scene.ts)对任何校园包零改动复用。

export const TILE = 16; // 每格 16px 像素(全局固定)

export type Rect = { x: number; y: number; w: number; h: number };

export type BuildingCategory =
  | "teaching" // 教学楼
  | "lab" // 实验/科研楼
  | "library" // 图书馆
  | "dorm" // 公寓
  | "canteen" // 餐厅
  | "shop" // 超市/驿站
  | "sports" // 体育场馆
  | "service" // 医院/会馆/活动中心
  | "landmark"; // 标志建筑

export type Building = Rect & {
  id: string;
  name: string;
  category: BuildingCategory;
  floors: number;
};

export type Gate = { id: string; name: string; x: number; y: number };

export type Lake = Rect & { id: string; name: string };

export type Plaza = Rect & { id: string; name: string; style: "stone" | "grass" };

export type Track = Rect & { id: string; name: string };

export type Court = Rect & { id: string; name: string; kind: "basket" | "tennis" | "volley" };

/** 功能分区:远景(zoom 很小)时显示区名大字,替代逐楼名牌 */
export type CampusZone = Rect & { id: string; name: string };

/** 装饰层:各校园可选的点缀(喷泉、樱花区、自行车、公告栏、出生广场) */
export type CampusDecorations = {
  /** 这些广场中央画喷泉 */
  fountainPlazaIds?: string[];
  /** 樱花树密集区(矩形格坐标) */
  sakura?: Rect;
  /** 额外的樱花飘落区(可以有多个) */
  sakuraAreas?: Rect[];
  /** 自行车成排点位 */
  bikes?: { x: number; y: number; n: number }[];
  /** 公告栏点位 */
  bulletinBoards?: { x: number; y: number }[];
  /** 出生点周围清空的广场(避免长树) */
  spawnApron?: Rect;
};

/** 伪天气的气候基数(按月分段取基准温度,详见 game.tsx 的 pseudoWeather) */
export type CampusWeather = {
  winterBase: number; // 12–2 月及 3/11 月
  shoulderBase: number; // 4–5、9–10 月
  summerBase: number; // 6–8 月
};

export type CampusBots = {
  count?: number; // 默认 24
  names: string[];
  lines: string[];
  /** 机器人巡逻落点(格坐标) */
  spots: { x: number; y: number }[];
};

export type CampusPack = {
  id: string;
  name: string; // HUD 标题,如「吉林大学像素地图」
  subtitle: string; // 标题下的小字
  credit: string; // 页脚署名
  world: { w: number; h: number }; // 世界尺寸(格)
  spawn: { x: number; y: number }; // 玩家出生点(格)
  defaultPlace: string; // 远离建筑时的地名
  weather: CampusWeather;
  roadsH: Rect[];
  roadsV: Rect[];
  lakes: Lake[];
  plazas: Plaza[];
  tracks: Track[];
  courts: Court[];
  buildings: Building[];
  gates: Gate[];
  zones?: CampusZone[];
  decorations?: CampusDecorations;
  bots: CampusBots;
};

// 建筑风味文案(按类别,全校园通用、原创)
export const CATEGORY_INFO: Record<BuildingCategory, { label: string; lines: string[] }> = {
  teaching: {
    label: "教学楼",
    lines: [
      "门口的自行车一大排,上课前十分钟最挤。",
      "走廊里都是背书的声音,期末周尤其明显。",
      "三楼靠窗的位置下午有太阳,很抢手。",
    ],
  },
  lab: {
    label: "实验楼",
    lines: [
      "晚上十点灯还亮着,科研人的日常。",
      "门口贴着最新的学术讲座海报。",
      "进门记得换鞋(不是)。",
    ],
  },
  library: {
    label: "图书馆",
    lines: [
      "早上开门前就有人排队,冲四楼靠窗。",
      "很安静,翻书声都听得清。",
      "记得带校园卡,别学有人忘在宿舍。",
    ],
  },
  dorm: {
    label: "学生公寓",
    lines: [
      "楼下取快递的队伍到了饭点最长。",
      "晚上阳台上晾的衣服像万国旗。",
      "熄灯后楼道里还有小声聊天的。",
    ],
  },
  canteen: {
    label: "餐厅",
    lines: [
      "饭点人山人海,建议错峰。",
      "今天窗口换新菜了,先替你尝了,不错。",
      "记得自带餐具,环保。",
    ],
  },
  shop: {
    label: "超市 / 商业楼",
    lines: [
      "一楼超市,关东煮很受欢迎。",
      "人最多的地方永远是奶茶窗口。",
      "晚上十点还是亮堂堂的。",
    ],
  },
  sports: {
    label: "体育场馆",
    lines: [
      "晚上灯全开,约球的人最多。",
      "记得提前订场地。",
      "跑两圈,出出汗,论文的事等会儿再说。",
    ],
  },
  service: {
    label: "服务设施",
    lines: ["办事记得带证件。", "门口的公告栏信息很全。", "工作人员都很耐心。"],
  },
  landmark: {
    label: "地标建筑",
    lines: [
      "拍校园卡照片的人都来这里取景。",
      "新生第一天一定会路过的地方。",
      "晚上亮灯之后更好看。",
    ],
  },
};

/** 建筑占位(w/h 为 0 的)不参与渲染与碰撞 */
export function solidBuildings(pack: CampusPack): Building[] {
  return pack.buildings.filter((b) => b.w > 0 && b.h > 0);
}

export function doorOf(b: Building): { x: number; y: number } {
  return { x: b.x + Math.floor(b.w / 2), y: b.y + b.h };
}

/** 通用机器人兜底内容:校园包没写 bots.names/lines 时使用 */
export const GENERIC_BOT_NAMES = ["早八人", "自习占座成功", "刚下课", "外卖在路上", "操场第三道", "图书馆四楼"];
export const GENERIC_BOT_LINES = ["快递到了,下楼去取。", "等室友下楼一起去吃饭。", "期末周保重,都别熬夜。", "明天又满课,哭。", "雨伞借你,明天记得还。"];
