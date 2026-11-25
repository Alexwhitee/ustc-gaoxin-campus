import { count } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as s from "./schema";

const H = 3_600_000;

type SeedUser = { id: string; name: string; avatar: string; level: number; bio: string };

const SEED_USERS: SeedUser[] = [
  { id: "u-foodie", name: "吉大干饭人", avatar: "🍜", level: 2, bio: "前卫南区吃什么我都懂" },
  { id: "u-nightowl", name: "半夜汽笛", avatar: "🚂", level: 1, bio: "晚睡选手" },
  { id: "u-xiaoxiao", name: "肖潇潇", avatar: "🌸", level: 2, bio: "CS 在读 · 摸鱼中" },
  { id: "u-milkdragon", name: "吉大奶龙", avatar: "🐉", level: 3, bio: "日新楼常驻人口" },
  { id: "u-hzsf", name: "hZsFN", avatar: "🦊", level: 3, bio: "模型炼丹师" },
  { id: "u-kai", name: "凯旋", avatar: "🎹", level: 1, bio: "大一新生" },
  { id: "u-crab", name: "摸鱼小红猫", avatar: "🐱", level: 2, bio: "实验室搬砖中" },
  { id: "u-sunrise", name: "晨读选手", avatar: "📖", level: 1, bio: "外语楼门口见" },
  { id: "u-geo", name: "南门快递侠", avatar: "📦", level: 2, bio: "菜鸟驿站常客" },
  { id: "u-basket", name: "篮球场角落", avatar: "🏀", level: 1, bio: "约球喊我" },
];

/** 经验值驱动的等级（与 lib/queries.ts 的 levelFor 一致） */
const expForLevel = (level: number) => 20 * (level - 1) * (level - 1);

type SeedPost = {
  authorId: string;
  title: string;
  content: string;
  images?: number[];
  topics: string[];
  kind: "post" | "short" | "work";
  hoursAgo: number;
  likeFrom: number; // 多少个种子用户点赞（真实写入 post_likes）
};

const SEED_POSTS: SeedPost[] = [
  {
    authorId: "u-foodie",
    title: "日新楼二楼那家港式茶餐厅真的封神",
    content:
      "咚咚咚，周末中午去日新楼，二楼新开的港式小馆，滑蛋虾仁饭 12 块，蛋超嫩！\n\n排队的人不少，建议 11:20 之前到。楼下超市新到的柠檬茶也很配。",
    images: [11, 23, 37],
    topics: ["chat", "works"],
    kind: "post",
    hoursAgo: 3,
    likeFrom: 8,
  },
  {
    authorId: "u-xiaoxiao",
    title: "唐敖庆楼 C 区自习占座攻略（期末版）",
    content:
      "亲测一周总结：\n\n1. 早上 7:40 前到三楼基本有座\n2. 四楼人少但是空调足、容易困\n3. 周末下午别去 C 区，去李四光楼\n\n祝大家期末都过！",
    topics: ["course"],
    kind: "post",
    hoursAgo: 7,
    likeFrom: 9,
  },
  {
    authorId: "u-hzsf",
    title: "用学校集群微调 7B 模型的一点经验",
    content:
      "最近在集群上跑了一个 7B 的 LoRA 微调，把踩的坑记一下：\n\n- 显存不够就先开 gradient checkpointing\n- 数据清洗比超参重要\n- checkpoint 一定勤存，集群会突然维护\n\n有问题评论区见。",
    topics: ["compute", "research"],
    kind: "post",
    hoursAgo: 10,
    likeFrom: 7,
  },
  {
    authorId: "u-milkdragon",
    title: "做了一个像素版吉大校园地图，快来逛逛",
    content:
      "把前卫南区按像素画的风格画了一遍，可以用方向键走动，空格看楼，M 看大地图。\n\n入口在侧边栏「吉林大学像素地图」，欢迎来里面找我玩。",
    images: [7],
    topics: ["works", "chat"],
    kind: "work",
    hoursAgo: 15,
    likeFrom: 10,
  },
  {
    authorId: "u-nightowl",
    title: "凌晨的清湖边真的很安静",
    content: "实验室出来路过清湖，灯全灭了只剩湖边两盏路灯。\n\n突然就觉得，为了毕业设计熬的这几个夜也还好。",
    topics: ["chat"],
    kind: "short",
    hoursAgo: 20,
    likeFrom: 6,
  },
  {
    authorId: "u-crab",
    title: "求推荐科研入门该读的论文清单",
    content:
      "刚进组，导师让我先读综述再读经典论文。有没有同方向的前辈分享一下入门路径？方向是多模态。",
    topics: ["research"],
    kind: "post",
    hoursAgo: 26,
    likeFrom: 2,
  },
  {
    authorId: "u-geo",
    title: "北门菜鸟驿站高峰期避坑指南",
    content:
      "每天 12:00-13:30 和 17:00 后是高峰，取件排队半小时起步。\n\n建议早上没课的时候去，或者用暂存架约晚间时段。",
    topics: ["chat"],
    kind: "post",
    hoursAgo: 31,
    likeFrom: 4,
  },
  {
    authorId: "u-basket",
    title: "周五晚上宋治平体育馆约球",
    content: "半场 3v3，水平不限，来了就行。晚上 7 点，评论区留微信。",
    topics: ["chat"],
    kind: "short",
    hoursAgo: 36,
    likeFrom: 1,
  },
  {
    authorId: "u-sunrise",
    title: "外语楼门口晨读第 30 天打卡",
    content: "坚持一个月了。今天背完了半本口语素材，冬天快来了，湖边风大，晨读的同学们记得穿多点。",
    topics: ["course"],
    kind: "short",
    hoursAgo: 44,
    likeFrom: 5,
  },
  {
    authorId: "u-hzsf",
    title: "网页版课程表工具，支持导入教务导出的 Excel",
    content:
      "用 AI 写的，纯前端，数据不上传。\n\n功能：导入课表 → 自动算空教室 → 支持导出 ics 到手机日历。点开就能跑，欢迎提 bug。",
    topics: ["tools", "works"],
    kind: "work",
    hoursAgo: 50,
    likeFrom: 7,
  },
  {
    authorId: "u-kai",
    title: "大一萌新求选课建议",
    content: "下周开始选下学期课了，想问下离散数学和数据结构一起修会不会太赶？每周大概要投入多少时间？",
    topics: ["course"],
    kind: "post",
    hoursAgo: 55,
    likeFrom: 1,
  },
  {
    authorId: "u-xiaoxiao",
    title: "校内黑客松复盘：48 小时我们做了什么",
    content:
      "上周比赛拿了二等奖，写个复盘。\n\n- 组队比选题重要\n- 第一晚一定要把跑通的最小 Demo 立起来\n- 路演 PPT 至少留 3 小时做\n\n明年想组个固定队，评论区扣 1。",
    images: [42],
    topics: ["hackathon"],
    kind: "post",
    hoursAgo: 60,
    likeFrom: 6,
  },
];

type SeedComment = { postId: number; authorId: string; content: string; hoursAgo: number };

const SEED_COMMENTS: SeedComment[] = [
  { postId: 1, authorId: "u-nightowl", content: "上周吃了，虾仁给得很大方", hoursAgo: 2 },
  { postId: 1, authorId: "u-milkdragon", content: "楼下超市的饭团也上新了，一起测评？", hoursAgo: 2.5 },
  { postId: 1, authorId: "u-geo", content: "已加入干饭清单", hoursAgo: 1.5 },
  { postId: 2, authorId: "u-kai", content: "四楼那个空调是真的足，戴外套去", hoursAgo: 5 },
  { postId: 2, authorId: "u-sunrise", content: "补充：一楼东侧插座多", hoursAgo: 6 },
  { postId: 3, authorId: "u-crab", content: "请问一下数据集是从哪里拿的呀", hoursAgo: 8 },
  { postId: 3, authorId: "u-xiaoxiao", content: "checkpoint 勤存是真的，血泪教训", hoursAgo: 9 },
  { postId: 4, authorId: "u-foodie", content: "在里面看到日新楼门口的奶茶摊了，细节好评", hoursAgo: 12 },
  { postId: 4, authorId: "u-nightowl", content: "已进图，在清湖边上", hoursAgo: 13 },
  { postId: 5, authorId: "u-sunrise", content: "那个路灯下面椅子不错", hoursAgo: 18 },
  { postId: 6, authorId: "u-hzsf", content: "多模态先把 CLIP 系列读顺，再看你方向的相关工作", hoursAgo: 20 },
  { postId: 9, authorId: "u-nightowl", content: "30 天了还坚持，佩服", hoursAgo: 40 },
  { postId: 10, authorId: "u-kai", content: "导出 ics 好用，已用上", hoursAgo: 45 },
  { postId: 11, authorId: "u-xiaoxiao", content: "一起修没问题，离散每周 6h、数据结构 8h 左右", hoursAgo: 50 },
  { postId: 12, authorId: "u-basket", content: "扣 1，明年算我一个", hoursAgo: 55 },
];

const SEED_CHAT: { userId: string; content: string; hoursAgo: number }[] = [
  { userId: "u-milkdragon", content: "有人一起去日新楼吃晚饭吗", hoursAgo: 2 },
  { userId: "u-xiaoxiao", content: "唐敖庆楼今天人好多", hoursAgo: 1.6 },
  { userId: "u-nightowl", content: "刚从实验室出来，天都黑了", hoursAgo: 1.2 },
  { userId: "u-foodie", content: "基础园今天有锅包肉！！", hoursAgo: 0.8 },
  { userId: "u-crab", content: "在清湖边晒了十分钟太阳，复活了", hoursAgo: 0.3 },
];

export function seedIfEmpty(db: BetterSQLite3Database<typeof s>) {
  const [{ n }] = db.select({ n: count() }).from(s.users).all();
  if (n > 0) return;

  const now = Date.now();

  try {
    seed(db, now);
  } catch (e) {
    // next build 多 worker 并发初始化：看到空表后同时写种子，
    // 输的那个撞唯一约束——事务已原子回滚，数据由赢的 worker 保证
    const isConstraint = (e as { code?: string })?.code?.startsWith("SQLITE_CONSTRAINT") ||
      /unique constraint/i.test((e as Error)?.message ?? "");
    if (!isConstraint) throw e;
  }
}

function seed(db: BetterSQLite3Database<typeof s>, now: number) {
  db.transaction((tx) => {
    tx.insert(s.users).values(
      SEED_USERS.map((u) => ({
        id: u.id,
        name: u.name,
        passwordHash: null, // 种子演示账号不可登录
        avatar: u.avatar,
        bio: u.bio,
        exp: expForLevel(u.level),
        createdAt: now - 90 * 24 * H,
      })),
    ).run();

    // 先插帖（拿自增 number，与 SEED_COMMENTS 的 postId 对应）
    const postNumbers = SEED_POSTS.map((p) =>
      tx
        .insert(s.posts)
        .values({
          authorId: p.authorId,
          title: p.title,
          content: p.content,
          images: p.images ? JSON.stringify(p.images) : null,
          topics: JSON.stringify(p.topics),
          kind: p.kind,
          location: "吉林",
          views: 80 + Math.floor(Math.random() * 800),
          createdAt: now - Math.round(p.hoursAgo * H),
        })
        .run().lastInsertRowid as number,
    );

    tx.insert(s.comments).values(
      SEED_COMMENTS.map((c, i) => ({
        id: `c-seed-${i + 1}`,
        postNumber: postNumbers[c.postId - 1],
        authorId: c.authorId,
        content: c.content,
        location: "吉林",
        createdAt: now - Math.round(c.hoursAgo * H),
      })),
    ).run();

    // 点赞从种子用户里取前 likeFrom 个（跳过作者本人），计数真实
    const likeRows: { postNumber: number; userId: string; createdAt: number }[] = [];
    SEED_POSTS.forEach((p, i) => {
      SEED_USERS.filter((u) => u.id !== p.authorId)
        .slice(0, p.likeFrom)
        .forEach((u) => likeRows.push({ postNumber: postNumbers[i], userId: u.id, createdAt: now }));
    });
    tx.insert(s.postLikes).values(likeRows).run();

    tx.insert(s.chatMessages).values(
      SEED_CHAT.map((m) => ({
        userId: m.userId,
        content: m.content,
        createdAt: now - Math.round(m.hoursAgo * H),
      })),
    ).run();
  });
}
