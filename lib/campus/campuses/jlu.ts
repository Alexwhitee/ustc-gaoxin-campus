// 吉林大学中心校区 · 前卫南区(自绘的简化版像素布局)
import type { CampusPack } from "../types";

export const jlu: CampusPack = {
  id: "jlu",
  name: "吉林大学像素地图",
  subtitle: "像素画风的校园地图 · 中心校区 · 前卫南区",
  credit:
    "地图资源 © OpenStreetMap 贡献者(ODbL 1.0);楼名与地标参照吉林大学官方校园地图;天气为演示数据",
  world: { w: 200, h: 150 },
  spawn: { x: 67, y: 131 }, // 日新楼门口
  defaultPlace: "前卫南区",
  weather: { winterBase: -6, shoulderBase: 12, summerBase: 22 },

  // 主干路:横三条、竖四条 + 环路补线(格子坐标)
  roadsH: [
    { x: 3, y: 30, w: 194, h: 3 }, // H1 北横路
    { x: 3, y: 70, w: 194, h: 3 }, // H2 中横路
    { x: 3, y: 108, w: 194, h: 3 }, // H3 南横路
  ],
  roadsV: [
    { x: 30, y: 3, w: 3, h: 144 }, // V1 西路
    { x: 72, y: 3, w: 3, h: 144 }, // V2 中路
    { x: 118, y: 3, w: 3, h: 144 }, // V3 东路
    { x: 162, y: 3, w: 3, h: 144 }, // V4 远东路
  ],

  lakes: [
    { id: "qinghu", name: "清湖", x: 6, y: 40, w: 22, h: 30 },
    { id: "yanhu", name: "晏湖", x: 66, y: 86, w: 16, h: 16 },
    { id: "sanjiahu", name: "三佳湖", x: 8, y: 118, w: 16, h: 18 },
  ],

  plazas: [
    { id: "wuyuehua", name: "五月花广场喷泉", x: 78, y: 52, w: 14, h: 9, style: "stone" },
    { id: "dingxin-n", name: "鼎新南广场", x: 88, y: 24, w: 32, h: 5, style: "stone" },
    { id: "gaokeji", name: "高科技广场", x: 168, y: 62, w: 16, h: 6, style: "stone" },
    { id: "baihuayuan", name: "百花园", x: 48, y: 114, w: 8, h: 8, style: "grass" },
    { id: "chenyuan", name: "晨园", x: 50, y: 78, w: 8, h: 6, style: "grass" },
  ],

  tracks: [{ id: "track", name: "吉林大学体育场", x: 122, y: 80, w: 24, h: 20 }],

  courts: [
    { id: "court-b1", name: "篮球场", x: 150, y: 82, w: 10, h: 6, kind: "basket" },
    { id: "court-b2", name: "篮球场", x: 150, y: 90, w: 10, h: 6, kind: "basket" },
    { id: "court-t1", name: "网球场", x: 150, y: 64, w: 12, h: 6, kind: "tennis" },
    { id: "court-v1", name: "排球场", x: 134, y: 64, w: 12, h: 6, kind: "volley" },
  ],

  buildings: [
    // ---- 北带(公寓与服务)----
    { id: "dorm-n1", name: "北苑一公寓", category: "dorm", x: 36, y: 10, w: 10, h: 9, floors: 6 },
    { id: "dorm-n2", name: "北苑二公寓", category: "dorm", x: 50, y: 10, w: 10, h: 9, floors: 6 },
    { id: "dorm-n3", name: "北苑三公寓", category: "dorm", x: 64, y: 10, w: 10, h: 9, floors: 6 },
    { id: "dorm-n4", name: "北苑四公寓", category: "dorm", x: 64, y: 21, w: 10, h: 7, floors: 6 },
    { id: "hospital", name: "吉林大学校医院", category: "service", x: 92, y: 8, w: 14, h: 10, floors: 4 },
    { id: "museum", name: "吉林大学考古与艺术博物馆", category: "landmark", x: 126, y: 10, w: 16, h: 10, floors: 3 },
    { id: "yizhan", name: "吉大北门菜鸟驿站", category: "shop", x: 66, y: 24, w: 8, h: 5, floors: 1 },
    { id: "youyihui", name: "吉林大学友谊会馆", category: "service", x: 148, y: 8, w: 16, h: 10, floors: 5 },

    // ---- 中轴(鼎新)----
    { id: "dingxin", name: "鼎新楼", category: "landmark", x: 86, y: 8, w: 16, h: 12, floors: 8 },
    { id: "dingxin-lib", name: "鼎新图书馆", category: "library", x: 106, y: 8, w: 14, h: 12, floors: 5 },

    // ---- A 带(H1 与 H2 之间:教学与科研)----
    { id: "waiyu", name: "外语楼", category: "teaching", x: 36, y: 36, w: 14, h: 10, floors: 5 },
    { id: "kuangyaming", name: "匡亚明楼", category: "teaching", x: 54, y: 36, w: 12, h: 10, floors: 5 },
    { id: "dongrong", name: "东荣大厦", category: "teaching", x: 36, y: 52, w: 12, h: 12, floors: 9 },
    { id: "jingxin-t", name: "经信教学楼", category: "teaching", x: 52, y: 52, w: 14, h: 12, floors: 5 },
    { id: "central-lib", name: "中心图书馆", category: "library", x: 92, y: 34, w: 18, h: 12, floors: 6 },
    { id: "wujichaofenzi", name: "无机-超分子楼", category: "lab", x: 122, y: 36, w: 12, h: 8, floors: 4 },
    { id: "wuli", name: "物理楼", category: "teaching", x: 122, y: 50, w: 12, h: 10, floors: 5 },
    { id: "tang-c", name: "唐敖庆楼C区", category: "lab", x: 138, y: 36, w: 10, h: 8, floors: 5 },
    { id: "tang-d", name: "唐敖庆楼D区", category: "lab", x: 138, y: 50, w: 10, h: 10, floors: 5 },
    { id: "tang", name: "唐敖庆楼", category: "landmark", x: 92, y: 52, w: 0, h: 0, floors: 0 }, // 占位:真实主体由 C/D 构成
    { id: "lishiguang", name: "李四光楼", category: "teaching", x: 168, y: 36, w: 12, h: 10, floors: 5 },
    { id: "wangxianghao", name: "王湘浩楼", category: "teaching", x: 168, y: 50, w: 12, h: 10, floors: 5 },

    // ---- B 带(H2 与 H3 之间)----
    { id: "yifu-lib", name: "逸夫图书馆", category: "library", x: 36, y: 78, w: 14, h: 10, floors: 4 },
    { id: "yifu-t", name: "逸夫教学楼", category: "teaching", x: 36, y: 92, w: 14, h: 10, floors: 5 },
    { id: "cuiwen", name: "萃文楼", category: "teaching", x: 54, y: 92, w: 10, h: 10, floors: 5 },
    { id: "wenke", name: "文科实验楼", category: "lab", x: 54, y: 78, w: 10, h: 8, floors: 4 },
    { id: "faxue", name: "法学楼", category: "teaching", x: 88, y: 78, w: 12, h: 8, floors: 4 },
    { id: "huodong", name: "学生活动中心", category: "service", x: 88, y: 92, w: 14, h: 8, floors: 3 },
    { id: "songzhiping", name: "宋治平体育馆", category: "sports", x: 104, y: 78, w: 14, h: 8, floors: 3 },
    { id: "qianwei-tiyu", name: "前卫体育馆", category: "sports", x: 168, y: 78, w: 14, h: 12, floors: 3 },
    { id: "jingxin-j", name: "敬信教学楼", category: "teaching", x: 168, y: 94, w: 14, h: 8, floors: 5 },
    { id: "lianxinyu", name: "基础园浴池", category: "service", x: 108, y: 96, w: 8, h: 6, floors: 1 },

    // ---- 南带(生活区)----
    { id: "rixin", name: "日新楼", category: "shop", x: 56, y: 116, w: 22, h: 12, floors: 5 },
    { id: "meiguiyuan", name: "玫瑰园餐厅楼", category: "canteen", x: 56, y: 132, w: 12, h: 8, floors: 3 },
    { id: "xinziyuan", name: "莘子园餐厅", category: "canteen", x: 84, y: 116, w: 12, h: 8, floors: 3 },
    { id: "jichuyuan", name: "基础园餐厅", category: "canteen", x: 84, y: 132, w: 12, h: 8, floors: 3 },
    { id: "hupan", name: "湖畔餐厅", category: "canteen", x: 122, y: 116, w: 12, h: 8, floors: 2 },
    { id: "nabo", name: "纳博士超市", category: "shop", x: 100, y: 132, w: 8, h: 6, floors: 1 },
    { id: "nanjiu", name: "南九致远超市", category: "shop", x: 112, y: 132, w: 8, h: 6, floors: 1 },
    { id: "nanba", name: "南八致远超市", category: "shop", x: 168, y: 132, w: 8, h: 6, floors: 1 },

    { id: "dorm-s1", name: "南苑一公寓", category: "dorm", x: 122, y: 126, w: 10, h: 7, floors: 6 },
    { id: "dorm-s2", name: "南苑二公寓", category: "dorm", x: 134, y: 126, w: 10, h: 7, floors: 6 },
    { id: "dorm-s3", name: "南苑三公寓", category: "dorm", x: 146, y: 126, w: 10, h: 7, floors: 6 },
    { id: "dorm-s4", name: "南苑四公寓", category: "dorm", x: 122, y: 137, w: 10, h: 7, floors: 6 },
    { id: "dorm-s5", name: "南苑五公寓", category: "dorm", x: 134, y: 137, w: 10, h: 7, floors: 6 },
    { id: "dorm-s6", name: "南苑六公寓", category: "dorm", x: 146, y: 137, w: 10, h: 7, floors: 6 },
    { id: "dorm-s7", name: "南苑七公寓", category: "dorm", x: 180, y: 116, w: 10, h: 7, floors: 6 },
    { id: "dorm-s8", name: "南苑八公寓", category: "dorm", x: 180, y: 126, w: 10, h: 7, floors: 6 },

    { id: "zhengxin", name: "吉林大学正新楼", category: "lab", x: 122, y: 96, w: 0, h: 0, floors: 0 }, // 占位
    { id: "zhengxin-main", name: "吉林大学正新楼", category: "lab", x: 168, y: 8, w: 0, h: 0, floors: 0 }, // 占位
    { id: "tiyuan", name: "国家天元数学东北中心", category: "lab", x: 152, y: 118, w: 14, h: 8, floors: 4 },
    { id: "shengming", name: "生命科学楼", category: "lab", x: 180, y: 62, w: 12, h: 10, floors: 5 },
    { id: "gaoxinya", name: "高压合成实验楼", category: "lab", x: 126, y: 8, w: 0, h: 0, floors: 0 }, // 占位

    // ---- 科技园(西青年路)----
    { id: "kejiyuan-b", name: "东北亚文化创意科技园B栋", category: "lab", x: 10, y: 96, w: 14, h: 8, floors: 4 },
    { id: "kejiyuan-c", name: "东北亚文化创意科技园C栋", category: "lab", x: 10, y: 106, w: 0, h: 0, floors: 0 }, // 占位
    { id: "kejiyuan-d", name: "东北亚文化创意科技园D栋", category: "lab", x: 36, y: 122, w: 10, h: 8, floors: 4 },
    { id: "kejiyuan-e", name: "东北亚文化创意科技园E栋", category: "lab", x: 36, y: 132, w: 0, h: 0, floors: 0 }, // 占位
    { id: "kaoqian", name: "长春建筑学院人工智能学院", category: "teaching", x: 8, y: 8, w: 16, h: 10, floors: 4 },
    { id: "kaoqian-lib", name: "长春建筑学院图书馆", category: "library", x: 8, y: 22, w: 14, h: 6, floors: 3 },
    { id: "dayaji", name: "大压机楼", category: "lab", x: 78, y: 78, w: 0, h: 0, floors: 0 }, // 占位
  ],

  // 功能分区(远景 zoom 时显示的大字区名)
  zones: [
    { id: "z-north-dorm", name: "北苑生活区", x: 30, y: 4, w: 52, h: 26 },
    { id: "z-axis", name: "鼎新中轴区", x: 84, y: 4, w: 40, h: 24 },
    { id: "z-west-teach", name: "西教学区", x: 28, y: 32, h: 36, w: 42 },
    { id: "z-east-teach", name: "东实验区", x: 116, y: 30, w: 72, h: 34 },
    { id: "z-sports", name: "体育运动区", x: 100, y: 60, w: 92, h: 46 },
    { id: "z-south-dorm", name: "南苑生活区", x: 50, y: 110, w: 110, h: 38 },
    { id: "z-tech-park", name: "科技园区", x: 4, y: 90, w: 42, h: 52 },
  ],

  // 校门(放在道路尽头)
  gates: [
    { id: "gate-s", name: "南门", x: 73, y: 147 },
    { id: "gate-n", name: "北门", x: 73, y: 3 },
    { id: "gate-w", name: "西门", x: 3, y: 71 },
    { id: "gate-e", name: "东门", x: 196, y: 71 },
    { id: "gate-nw", name: "硅谷大街门(西北门)", x: 3, y: 31 },
    { id: "gate-xb", name: "小北门", x: 96, y: 3 },
    { id: "gate-jx", name: "敬信小门", x: 196, y: 109 },
  ],

  decorations: {
    fountainPlazaIds: ["wuyuehua"],
    sakura: { x: 51, y: 111, w: 32, h: 7 }, // 日新楼周边樱花区
    bikes: [
      { x: 60, y: 127, n: 8 }, // 日新楼北墙下
      { x: 88, y: 125, n: 6 }, // 莘子园
      { x: 40, y: 47, n: 7 }, // 外语楼
      { x: 56, y: 65, n: 6 }, // 经信楼
      { x: 126, y: 61, n: 5 }, // 物理楼
    ],
    bulletinBoards: [{ x: 52, y: 130 }],
    spawnApron: { x: 58, y: 128, w: 25, h: 7 }, // 日新楼前广场(出生点周围大片空地)
  },

  bots: {
    count: 24,
    names: [
      "南门快递侠", "清湖边的猫", "晚风与晚课", "萃文楼内线", "第五节课划水",
      "湖畔干饭王", "日新楼居民", "唐敖庆楼钉子户", "逸夫夜读人", "北苑早八侠",
      "体育场地板侠", "南苑夜跑团", "鼎新看门大爷", "晨读第30天", "图书馆四楼",
      "超市关东煮", "东坡买橘子", "实验室灯还亮", "琴房练琴人", "操场第三道",
      "雨天的经信楼", "樱花树下", "自习占座成功", "刚下课", "外卖在北门", "核酸亭旧址",
    ],
    lines: [
      "下节课在李四光楼,先去门口等等。",
      "快递到了,下楼去取。",
      "早上在楼前读英语的人不少。",
      "等室友下楼一起去吃饭。",
      "今天莘子园有锅包肉!",
      "图书馆四楼有插座,冲。",
      "晚上体育场约球吗?",
      "日新楼的奶茶排好长。",
      "期末周保重,都别熬夜。",
      "听说清湖边晚上有猫。",
      "樱花开了,快去拍照。",
      "刚从实验室出来,好饿。",
      "逸夫教学楼第三排椅子不稳。",
      "明天又满课,哭。",
      "雨伞借你,明天记得还。",
    ],
    spots: [
      { x: 67, y: 131 }, { x: 40, y: 46 }, { x: 90, y: 40 }, { x: 100, y: 90 },
      { x: 60, y: 120 }, { x: 130, y: 88 }, { x: 74, y: 60 }, { x: 120, y: 120 },
      { x: 46, y: 96 }, { x: 150, y: 60 }, { x: 90, y: 126 }, { x: 170, y: 120 },
      { x: 30, y: 80 }, { x: 110, y: 50 }, { x: 76, y: 96 }, { x: 140, y: 130 },
    ],
  },
};
