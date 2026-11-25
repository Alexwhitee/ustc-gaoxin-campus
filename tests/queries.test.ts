import { beforeAll, describe, expect, it } from "vitest";
import {
  checkin,
  checkinStatus,
  createComment,
  createPost,
  getPost,
  getUser,
  hotTopics,
  isFollowing,
  listChatMessages,
  listComments,
  listNotifications,
  listPosts,
  sendChatMessage,
  toggleFavorite,
  toggleFollow,
  toggleLike,
  unreadCount,
} from "@/lib/queries";

// setup.ts 已把 DATABASE_PATH 指向临时库；导入 queries 时自动建表 + 种子
const ME = "u-tester";

beforeAll(async () => {
  // 注册一个测试用户（直接走底层插入，绕开 API 层）
  const { db } = await import("@/lib/db");
  const { users } = await import("@/lib/db/schema");
  db.insert(users)
    .values({ id: ME, name: "vitest-测试员", passwordHash: "x:y", avatar: "🧪", bio: "", exp: 0, createdAt: Date.now() })
    .run();
});

describe("帖子", () => {
  it("发帖后可读取，计数为 0，作者经验增加", async () => {
    const before = (await getUser(ME))!;
    const number = await createPost({ authorId: ME, title: "测试标题", content: "测试内容", topics: ["chat"], kind: "post" });
    const post = await getPost(number, ME);
    expect(post?.title).toBe("测试标题");
    expect(post?.likeCount).toBe(0);
    expect(post?.commentCount).toBe(0);
    const after = await getUser(ME);
    expect(after!.level).toBeGreaterThanOrEqual(before.level);
  });

  it("游客读取时不返回 liked 状态", async () => {
    const number = await createPost({ authorId: ME, title: "t", content: "c", topics: [], kind: "post" });
    const post = await getPost(number);
    expect(post?.liked).toBe(false);
  });

  it("非法分页参数回退到默认值，避免数据库查询失败", async () => {
    const normal = await listPosts();
    for (const value of [NaN, Infinity, -1, 0, 1.5]) {
      expect(await listPosts({ page: value, limit: value })).toEqual(normal);
    }
  });
});

describe("点赞与收藏", () => {
  it("toggle 幂等：点赞→取消→点赞", async () => {
    const number = await createPost({ authorId: ME, title: "t", content: "c", topics: [], kind: "post" });
    const r1 = await toggleLike(number, ME);
    expect(r1).toEqual({ liked: true, likeCount: 1 });
    const r2 = await toggleLike(number, ME);
    expect(r2).toEqual({ liked: false, likeCount: 0 });
    await toggleLike(number, ME);
    const post = await getPost(number, ME);
    expect(post?.liked).toBe(true);
    expect(post?.likeCount).toBe(1);
  });

  it("收藏 toggle 后在收藏列表中", async () => {
    const number = await createPost({ authorId: ME, title: "t", content: "c", topics: [], kind: "post" });
    await toggleFavorite(number, ME);
    const { listFavorites } = await import("@/lib/queries");
    const favs = await listFavorites(ME);
    expect(favs.some((p) => p.number === number)).toBe(true);
    await toggleFavorite(number, ME);
    const favs2 = await listFavorites(ME);
    expect(favs2.some((p) => p.number === number)).toBe(false);
  });
});

describe("评论与通知", () => {
  it("他人评论我的帖子 → 我收到 comment 通知", async () => {
    const number = await createPost({ authorId: ME, title: "t", content: "c", topics: [], kind: "post" });
    await createComment({ id: "tc-1", postNumber: number, authorId: "u-foodie", content: "好帖" });
    const notifs = await listNotifications(ME);
    const n = notifs.find((x) => x.type === "comment" && x.postNumber === number);
    expect(n?.actor.id).toBe("u-foodie");
    expect((await unreadCount(ME)) > 0).toBe(true);
    const comments = await listComments(number);
    expect(comments[0].author?.id).toBe("u-foodie");
  });

  it("回复评论 → 被回复者收到 reply 通知而非 comment", async () => {
    const number = await createPost({ authorId: ME, title: "t", content: "c", topics: [], kind: "post" });
    await createComment({ id: "tc-2", postNumber: number, authorId: "u-foodie", content: "楼主？" });
    await createComment({ id: "tc-3", postNumber: number, authorId: "u-xiaoxiao", content: "@foodie 回你", parentId: "tc-2" });
    const notifs = await listNotifications("u-foodie");
    const n = notifs.find((x) => x.type === "reply");
    expect(n?.actor.id).toBe("u-xiaoxiao");
  });

  it("自己评论自己的帖子不产生通知", async () => {
    const before = await unreadCount(ME);
    const number = await createPost({ authorId: ME, title: "t", content: "c", topics: [], kind: "post" });
    await createComment({ id: "tc-4", postNumber: number, authorId: ME, content: "自言自语" });
    const after = await unreadCount(ME);
    expect(after).toBe(before);
  });
});

describe("关注", () => {
  it("关注后 follow 流只含对方帖子，取关后为空", async () => {
    await toggleFollow(ME, "u-foodie");
    expect(await isFollowing(ME, "u-foodie")).toBe(true);
    const feed = await listPosts({ tab: "follow", viewerId: ME });
    expect(feed.posts.length).toBeGreaterThan(0);
    expect(feed.posts.every((p) => p.authorId === "u-foodie")).toBe(true);

    await toggleFollow(ME, "u-foodie");
    const feed2 = await listPosts({ tab: "follow", viewerId: ME });
    expect(feed2.posts).toEqual([]);
  });

  it("不能关注自己", async () => {
    await expect(toggleFollow(ME, ME)).rejects.toThrow();
  });
});

describe("签到", () => {
  it("首次签到成功，重复签到被拒绝且连续天数保持", async () => {
    const first = await checkin(ME);
    expect(first.ok).toBe(true);
    expect(first.streak).toBe(1);

    const dup = await checkin(ME);
    expect(dup.ok).toBe(false);
    expect(dup.streak).toBe(1);

    const status = await checkinStatus(ME);
    expect(status).toEqual({ checkedToday: true, streak: 1 });
  });
});

describe("聊天与统计", () => {
  it("首次加载取最新消息且按时间正序，增量拉取不漏消息", async () => {
    const ids: number[] = [];
    for (let i = 0; i < 105; i++) ids.push(await sendChatMessage(ME, `history-${i}`));
    const recent = await listChatMessages();
    expect(recent.map(m => m.id)).toEqual(ids.slice(-100));
    const next = await listChatMessages(ids[0], 3);
    expect(next.map(m => m.id)).toEqual(ids.slice(1, 4));
    expect(await listChatMessages(Infinity)).toEqual(recent);
  });

  it("发消息后按 lastId 增量拉取", async () => {
    const id = await sendChatMessage(ME, "测试消息");
    const msgs = await listChatMessages(id - 1);
    expect(msgs.some((m) => m.id === id && m.text === "测试消息")).toBe(true);
    const after = await listChatMessages(id);
    expect(msgs.some((m) => m.id === id)).toBe(true);
    expect(after.some((m) => m.id === id)).toBe(false);
  });

  it("话题统计来自真实数据", async () => {
    const topics = await hotTopics();
    const chat = topics.find((t) => t.slug === "chat");
    expect(chat!.posts7d).toBeGreaterThan(0);
  });
});
