import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** 用户：password_hash 为空的种子用户不可登录 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  passwordHash: text("password_hash"),
  avatar: text("avatar").notNull().default("🎓"),
  bio: text("bio").notNull().default(""),
  exp: integer("exp").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const posts = sqliteTable(
  "posts",
  {
    number: integer("number").primaryKey({ autoIncrement: true }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    content: text("content").notNull(),
    images: text("images"), // JSON number[]
    topics: text("topics").notNull(), // JSON string[]
    kind: text("kind").notNull().default("post"), // post | short | work
    location: text("location").notNull().default("吉林"),
    pinned: integer("pinned").notNull().default(0),
    views: integer("views").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("posts_created_idx").on(t.createdAt),
    index("posts_author_idx").on(t.authorId),
  ],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postNumber: integer("post_number")
      .notNull()
      .references(() => posts.number, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    parentId: text("parent_id"), // 楼中楼：指向另一条评论
    content: text("content").notNull(),
    location: text("location").notNull().default("吉林"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("comments_post_idx").on(t.postNumber)],
);

export const postLikes = sqliteTable(
  "post_likes",
  {
    postNumber: integer("post_number")
      .notNull()
      .references(() => posts.number, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.postNumber, t.userId] })],
);

export const commentLikes = sqliteTable(
  "comment_likes",
  {
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })],
);

export const favorites = sqliteTable(
  "favorites",
  {
    postNumber: integer("post_number")
      .notNull()
      .references(() => posts.number, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.postNumber, t.userId] })],
);

export const follows = sqliteTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: text("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followeeId] })],
);

/** type: comment（评论我的帖子）| reply（回复我的评论）| like（赞）| follow（关注） */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // 接收者
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    postNumber: integer("post_number").references(() => posts.number, { onDelete: "cascade" }),
    commentId: text("comment_id"),
    read: integer("read").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/** date 为本地时区 YYYY-MM-DD，(userId, date) 唯一 */
export const checkins = sqliteTable(
  "checkins",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("chat_created_idx").on(t.createdAt)],
);

export type UserRow = typeof users.$inferSelect;
export type PostRow = typeof posts.$inferSelect;
export type CommentRow = typeof comments.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
