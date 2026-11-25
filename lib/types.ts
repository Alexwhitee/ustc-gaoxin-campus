export type User = {
  id: string;
  name: string;
  avatar: string; // emoji，配合底色生成像素风头像
  level: number;
  bio?: string;
  posts7d?: number; // 近 7 天发帖数
  followers?: number;
  following?: number;
};

export type PostKind = "post" | "short" | "work";

export type Comment = {
  id: string;
  postId: number;
  authorId: string;
  content: string;
  createdAt: string;
  location?: string; // IP 属地
  likeCount: number;
};

export type Post = {
  number: number;
  authorId: string;
  title: string;
  content: string;
  images?: number[]; // 占位图 seed，渲染成渐变 + emoji 的示意图
  topics: string[]; // topic slug 列表
  kind: PostKind;
  createdAt: string;
  location?: string; // IP 属地
  pinned?: boolean;
  views?: number;
  commentCount: number;
  likeCount: number;
  favoriteCount: number;
};

export type Topic = {
  slug: string;
  name: string;
  icon: string; // lucide 图标名
  posts7d: number;
  description?: string;
};

export type SessionUser = User;

export const TOPICS: Topic[] = [
  { slug: "course", name: "选课与学习", icon: "BookOpen", posts7d: 12, description: "选课攻略、刷题、期末、绩点……" },
  { slug: "research", name: "科研与实验室", icon: "FlaskConical", posts7d: 4, description: "进组、科研入门、论文与竞赛" },
  { slug: "hackathon", name: "竞赛与黑客松", icon: "Trophy", posts7d: 2, description: "组队、赛题讨论、路演复盘" },
  { slug: "job", name: "求职与实习", icon: "Briefcase", posts7d: 5, description: "实习内推、面经、秋招春招" },
  { slug: "compute", name: "模型与算力", icon: "Cpu", posts7d: 7, description: "大模型、显卡、集群、微调部署" },
  { slug: "tools", name: "工具与产品", icon: "Wrench", posts7d: 9, description: "好用的工具、AI 产品测评" },
  { slug: "works", name: "作品分享", icon: "Rocket", posts7d: 7, description: "晒出你做的小东西，点开就能跑" },
  { slug: "chat", name: "闲聊", icon: "Coffee", posts7d: 34, description: "灌水、日常、校园大事小情" },
];

export const topicName = (slug: string) =>
  TOPICS.find((t) => t.slug === slug)?.name ?? slug;
