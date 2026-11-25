import { and, count, desc, eq, gte, inArray, like, sql } from "drizzle-orm";
import { db } from "./db";
import {
  chatMessages,
  checkins,
  commentLikes,
  comments,
  favorites,
  follows,
  notifications,
  postLikes,
  posts,
  users,
} from "./db/schema";
import type { Comment, Post, Topic, User } from "./types";
import { TOPICS } from "./types";

const DAY = 86_400_000;

// ---------- 工具 ----------

export const levelFor = (exp: number) => Math.min(9, Math.floor(Math.sqrt(Math.max(0, exp) / 20)) + 1);

function toUser(row: { id: string; name: string; avatar: string; bio: string; exp: number }): User {
  return { id: row.id, name: row.name, avatar: row.avatar, level: levelFor(row.exp), bio: row.bio || undefined };
}

const parseImages = (raw: string | null): number[] | undefined =>
  raw ? (JSON.parse(raw) as number[]) : undefined;
const parseTopics = (raw: string): string[] => JSON.parse(raw) as string[];

type PostRowJoined = {
  number: number;
  authorId: string;
  title: string;
  content: string;
  images: string | null;
  topics: string;
  kind: string;
  location: string;
  pinned: number;
  views: number;
  createdAt: number;
};

function countsBy<T extends string | number>(rows: { key: T; n: number }[]) {
  const m = new Map<T, number>();
  for (const r of rows) m.set(r.key, r.n);
  return m;
}

async function postAggregates(numbers: number[]) {
  if (numbers.length === 0) return { likes: new Map<number, number>(), comments: new Map<number, number>(), favs: new Map<number, number>() };
  const [likes, cmts, favs] = await Promise.all([
    db.select({ key: postLikes.postNumber, n: count() }).from(postLikes).where(inArray(postLikes.postNumber, numbers)).groupBy(postLikes.postNumber),
    db.select({ key: comments.postNumber, n: count() }).from(comments).where(inArray(comments.postNumber, numbers)).groupBy(comments.postNumber),
    db.select({ key: favorites.postNumber, n: count() }).from(favorites).where(inArray(favorites.postNumber, numbers)).groupBy(favorites.postNumber),
  ]);
  return { likes: countsBy(likes), comments: countsBy(cmts), favs: countsBy(favs) };
}

function toPost(row: PostRowJoined, agg: { likes: Map<number, number>; comments: Map<number, number>; favs: Map<number, number> }): Post {
  return {
    number: row.number,
    authorId: row.authorId,
    title: row.title,
    content: row.content,
    images: parseImages(row.images),
    topics: parseTopics(row.topics),
    kind: row.kind as Post["kind"],
    createdAt: new Date(row.createdAt).toISOString(),
    location: row.location,
    pinned: row.pinned === 1,
    views: row.views,
    likeCount: agg.likes.get(row.number) ?? 0,
    commentCount: agg.comments.get(row.number) ?? 0,
    favoriteCount: agg.favs.get(row.number) ?? 0,
  };
}

// ---------- 读 ----------

export async function getUser(id: string): Promise<User | null> {
  const row = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row[0] ? toUser(row[0]) : null;
}

export async function getUserStats(id: string): Promise<{ posts: number; followers: number; following: number }> {
  const [p, f, g] = await Promise.all([
    db.select({ n: count() }).from(posts).where(eq(posts.authorId, id)),
    db.select({ n: count() }).from(follows).where(eq(follows.followeeId, id)),
    db.select({ n: count() }).from(follows).where(eq(follows.followerId, id)),
  ]);
  return { posts: p[0].n, followers: f[0].n, following: g[0].n };
}

export type ListPostsOpts = {
  topic?: string;
  tab?: string; // short | work | follow（follow 需要传 viewerId）
  authorId?: string;
  viewerId?: string;
  page?: number;
  limit?: number;
};

export async function listPosts(opts: ListPostsOpts = {}): Promise<{ posts: Post[]; hasMore: boolean }> {
  const requestedLimit = opts.limit ?? 20;
  const requestedPage = opts.page ?? 1;
  const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 20;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const conds = [];
  if (opts.topic) conds.push(like(posts.topics, `%"${opts.topic}"%`));
  if (opts.tab === "short" || opts.tab === "work") conds.push(eq(posts.kind, opts.tab));
  if (opts.authorId) conds.push(eq(posts.authorId, opts.authorId));
  if (opts.tab === "follow" && opts.viewerId) {
    conds.push(inArray(posts.authorId, db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, opts.viewerId))));
  }

  const rows = await db
    .select()
    .from(posts)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(posts.pinned), desc(posts.createdAt))
    .limit(limit + 1)
    .offset((page - 1) * limit);

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const agg = await postAggregates(pageRows.map((r) => r.number));
  return { posts: pageRows.map((r) => toPost(r, agg)), hasMore };
}

export async function getPost(number: number, viewerId?: string): Promise<
  (Post & { liked: boolean; favorited: boolean }) | null
> {
  const row = await db.select().from(posts).where(eq(posts.number, number)).limit(1);
  if (!row[0]) return null;
  const agg = await postAggregates([number]);
  let liked = false;
  let favorited = false;
  if (viewerId) {
    const [l, f] = await Promise.all([
      db.select().from(postLikes).where(and(eq(postLikes.postNumber, number), eq(postLikes.userId, viewerId))).limit(1),
      db.select().from(favorites).where(and(eq(favorites.postNumber, number), eq(favorites.userId, viewerId))).limit(1),
    ]);
    liked = l.length > 0;
    favorited = f.length > 0;
  }
  return { ...toPost(row[0], agg), liked, favorited };
}

export async function listComments(postNumber: number): Promise<(Comment & { author: User | null; likeCount: number; liked: boolean })[]> {
  const rows = await db.select().from(comments).where(eq(comments.postNumber, postNumber)).orderBy(comments.createdAt);
  if (rows.length === 0) return [];
  const authorRows = await db.select().from(users).where(inArray(users.id, [...new Set(rows.map(r => r.authorId))]));
  const authorMap = new Map(authorRows.map((u) => [u.id, toUser(u)]));
  const likeCounts = countsBy(
    await db
      .select({ key: commentLikes.commentId, n: count() })
      .from(commentLikes)
      .where(inArray(commentLikes.commentId, rows.map((r) => r.id)))
      .groupBy(commentLikes.commentId),
  );
  return rows.map((r) => ({
    id: r.id,
    postId: r.postNumber,
    authorId: r.authorId,
    parentId: r.parentId ?? undefined,
    content: r.content,
    createdAt: new Date(r.createdAt).toISOString(),
    location: r.location,
    likeCount: likeCounts.get(r.id) ?? 0,
    liked: false,
    author: authorMap.get(r.authorId) ?? null,
  }));
}

export async function hotTopics(): Promise<Topic[]> {
  const since = Date.now() - 7 * DAY;
  const rows = await db.select({ topics: posts.topics }).from(posts).where(gte(posts.createdAt, since));
  const m = new Map<string, number>();
  for (const r of rows) {
    for (const t of JSON.parse(r.topics) as string[]) m.set(t, (m.get(t) ?? 0) + 1);
  }
  return [...TOPICS].map((t) => ({ ...t, posts7d: m.get(t.slug) ?? 0 })).sort((a, b) => b.posts7d - a.posts7d);
}

export async function activeUsers(): Promise<User[]> {
  const since = Date.now() - 7 * DAY;
  const rows = await db
    .select({ id: users.id, name: users.name, avatar: users.avatar, bio: users.bio, exp: users.exp, n: count(posts.number) })
    .from(users)
    .leftJoin(posts, and(eq(posts.authorId, users.id), gte(posts.createdAt, since)))
    .groupBy(users.id)
    .orderBy(desc(count(posts.number)))
    .limit(6);
  return rows.filter((r) => r.n > 0).map((r) => ({ ...toUser(r), posts7d: r.n }));
}

// ---------- 写 ----------

export async function incrementViews(number: number) {
  await db.update(posts).set({ views: sql`${posts.views} + 1` }).where(eq(posts.number, number));
}

export async function createPost(input: {
  authorId: string;
  title: string;
  content: string;
  images?: number[];
  topics: string[];
  kind: string;
}): Promise<number> {
  const r = await db
    .insert(posts)
    .values({
      authorId: input.authorId,
      title: input.title,
      content: input.content,
      images: input.images?.length ? JSON.stringify(input.images.slice(0, 4)) : null,
      topics: JSON.stringify(input.topics.length ? input.topics.slice(0, 2) : ["chat"]),
      kind: input.kind === "short" || input.kind === "work" ? input.kind : "post",
      createdAt: Date.now(),
    })
    .run();
  await awardExp(input.authorId, 5);
  return r.lastInsertRowid as number;
}

export async function createComment(input: {
  id: string;
  postNumber: number;
  authorId: string;
  parentId?: string;
  content: string;
}): Promise<void> {
  const post = await db.select({ authorId: posts.authorId, title: posts.title }).from(posts).where(eq(posts.number, input.postNumber)).limit(1);
  await db.insert(comments).values({
    id: input.id,
    postNumber: input.postNumber,
    authorId: input.authorId,
    parentId: input.parentId ?? null,
    content: input.content,
    createdAt: Date.now(),
  });
  await awardExp(input.authorId, 2);

  // 通知：帖子作者（评论）；被回复者（回复）
  let notifyUserId = post[0]?.authorId;
  let type = "comment";
  if (input.parentId) {
    const parent = await db.select({ authorId: comments.authorId }).from(comments).where(eq(comments.id, input.parentId)).limit(1);
    if (parent[0] && parent[0].authorId !== input.authorId) {
      notifyUserId = parent[0].authorId;
      type = "reply";
    }
  }
  if (notifyUserId && notifyUserId !== input.authorId) {
    await db.insert(notifications).values({
      id: `n-${input.id}`,
      userId: notifyUserId,
      actorId: input.authorId,
      type,
      postNumber: input.postNumber,
      commentId: input.id,
      createdAt: Date.now(),
    });
  }
}

export async function toggleLike(postNumber: number, userId: string): Promise<{ liked: boolean; likeCount: number }> {
  const existing = await db.select().from(postLikes).where(and(eq(postLikes.postNumber, postNumber), eq(postLikes.userId, userId))).limit(1);
  const post = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.number, postNumber)).limit(1);
  if (existing[0]) {
    await db.delete(postLikes).where(and(eq(postLikes.postNumber, postNumber), eq(postLikes.userId, userId)));
  } else {
    await db.insert(postLikes).values({ postNumber, userId, createdAt: Date.now() });
    await awardExp(post[0]?.authorId ?? "", 1);
    if (post[0] && post[0].authorId !== userId) {
      await db.insert(notifications).values({
        id: `n-l-${postNumber}-${userId}-${Date.now()}`,
        userId: post[0].authorId,
        actorId: userId,
        type: "like",
        postNumber,
        createdAt: Date.now(),
      });
    }
  }
  const [{ n }] = await db.select({ n: count() }).from(postLikes).where(eq(postLikes.postNumber, postNumber));
  return { liked: !existing[0], likeCount: n };
}

export async function toggleFavorite(postNumber: number, userId: string): Promise<{ favorited: boolean; favoriteCount: number }> {
  const existing = await db.select().from(favorites).where(and(eq(favorites.postNumber, postNumber), eq(favorites.userId, userId))).limit(1);
  if (existing[0]) {
    await db.delete(favorites).where(and(eq(favorites.postNumber, postNumber), eq(favorites.userId, userId)));
  } else {
    await db.insert(favorites).values({ postNumber, userId, createdAt: Date.now() });
  }
  const [{ n }] = await db.select({ n: count() }).from(favorites).where(eq(favorites.postNumber, postNumber));
  return { favorited: !existing[0], favoriteCount: n };
}

export async function toggleFollow(followerId: string, followeeId: string): Promise<{ following: boolean }> {
  if (followerId === followeeId) throw new Error("不能关注自己");
  const existing = await db.select().from(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId))).limit(1);
  if (existing[0]) {
    await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
    return { following: false };
  }
  await db.insert(follows).values({ followerId, followeeId, createdAt: Date.now() });
  await db.insert(notifications).values({
    id: `n-f-${followerId}-${followeeId}-${Date.now()}`,
    userId: followeeId,
    actorId: followerId,
    type: "follow",
    createdAt: Date.now(),
  });
  return { following: true };
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const r = await db.select().from(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId))).limit(1);
  return r.length > 0;
}

export async function awardExp(userId: string, amount: number) {
  if (!userId || amount === 0) return;
  await db.update(users).set({ exp: sql`${users.exp} + ${amount}` }).where(eq(users.id, userId));
}

// ---------- 签到 ----------

const localDate = (ts = Date.now()) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export async function checkinStatus(userId: string): Promise<{ checkedToday: boolean; streak: number }> {
  const today = localDate();
  const rows = await db.select().from(checkins).where(eq(checkins.userId, userId)).orderBy(desc(checkins.date)).limit(400);
  const dates = new Set(rows.map((r) => r.date));
  const checkedToday = dates.has(today);

  let streak = 0;
  const cursor = new Date();
  if (!checkedToday) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    if (dates.has(localDate(cursor.getTime()))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return { checkedToday, streak };
}

export async function checkin(userId: string): Promise<{ ok: boolean; streak: number; expGained: number }> {
  const status = await checkinStatus(userId);
  if (status.checkedToday) return { ok: false, streak: status.streak, expGained: 0 };
  await db.insert(checkins).values({ userId, date: localDate(), createdAt: Date.now() });
  await awardExp(userId, 10);
  return { ok: true, streak: status.streak + 1, expGained: 10 };
}

// ---------- 通知 ----------

export async function listNotifications(userId: string, limit = 50) {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      postNumber: notifications.postNumber,
      read: notifications.read,
      createdAt: notifications.createdAt,
      actor: { id: users.id, name: users.name, avatar: users.avatar, bio: users.bio, exp: users.exp },
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.actorId, users.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  const postTitles = new Map<number, string>();
  const nums = [...new Set(rows.map((r) => r.postNumber).filter((n): n is number => n != null))];
  if (nums.length) {
    const t = await db.select({ number: posts.number, title: posts.title }).from(posts).where(inArray(posts.number, nums));
    t.forEach((p) => postTitles.set(p.number, p.title));
  }
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    postNumber: r.postNumber,
    postTitle: r.postNumber ? postTitles.get(r.postNumber) : undefined,
    read: r.read === 1,
    createdAt: new Date(r.createdAt).toISOString(),
    actor: toUser(r.actor),
  }));
}

export async function unreadCount(userId: string): Promise<number> {
  const [{ n }] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.read, 0)));
  return n;
}

export async function markAllNotificationsRead(userId: string) {
  await db.update(notifications).set({ read: 1 }).where(eq(notifications.userId, userId));
}

// ---------- 聊天 ----------

export async function listChatMessages(afterId = 0, limit = 100) {
  afterId = Number.isSafeInteger(afterId) && afterId > 0 ? afterId : 0;
  limit = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 100;
  const conds = afterId > 0 ? [sql`${chatMessages.id} > ${afterId}`] : [];
  const rows = await db
    .select({
      id: chatMessages.id,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
      author: { id: users.id, name: users.name, avatar: users.avatar, bio: users.bio, exp: users.exp },
    })
    .from(chatMessages)
    .innerJoin(users, eq(chatMessages.userId, users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(afterId > 0 ? chatMessages.id : desc(chatMessages.id))
    .limit(limit);
  if (afterId === 0) rows.reverse();
  return rows.map((r) => ({
    id: r.id,
    text: r.content,
    at: new Date(r.createdAt).toISOString(),
    author: toUser(r.author),
  }));
}

export async function sendChatMessage(userId: string, content: string) {
  const r = await db.insert(chatMessages).values({ userId, content, createdAt: Date.now() }).run();
  return r.lastInsertRowid as number;
}

// ---------- 收藏列表 ----------

export async function listFavorites(userId: string): Promise<Post[]> {
  const rows = await db
    .select({ post: posts })
    .from(favorites)
    .innerJoin(posts, eq(favorites.postNumber, posts.number))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
  const agg = await postAggregates(rows.map((r) => r.post.number));
  return rows.map((r) => toPost(r.post, agg));
}

// ---------- 广场 ----------

export async function hotPosts(limit = 9): Promise<(Post & { author: User | null })[]> {
  const rows = await db.select().from(posts).orderBy(desc(posts.createdAt)).limit(200);
  const agg = await postAggregates(rows.map((r) => r.number));
  const authorRows = await db.select().from(users).where(inArray(users.id, [...new Set(rows.map(r => r.authorId))]));
  const authorMap = new Map(authorRows.map((u) => [u.id, toUser(u)]));
  return rows
    .map((r) => ({ ...toPost(r, agg), author: authorMap.get(r.authorId) ?? null }))
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, limit);
}
