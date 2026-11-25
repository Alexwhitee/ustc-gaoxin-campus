import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

const g = globalThis as unknown as { __jluaiSqlite?: Database.Database };

/** 同步等待（重试 SQLite BUSY 用） */
function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withRetry<T>(label: string, fn: () => T, tries = 10): T {
  for (let i = 0; ; i++) {
    try {
      return fn();
    } catch (e) {
      // 并发初始化（如 next build 多 worker）时会短暂锁库，指数退避重试
      if (i >= tries - 1 || !String(e).includes("locked")) {
        console.error(`[db] ${label} 失败：`, e);
        throw e;
      }
      sleepSync(60 * 2 ** i);
    }
  }
}

function connect(): Database.Database {
  if (g.__jluaiSqlite) return g.__jluaiSqlite;

  const dbPath =
    process.env.DATABASE_PATH ??
    path.join(process.env.DATABASE_DIR ?? path.join(process.cwd(), "data"), "jluai.db");
  mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("busy_timeout = 10000");
  sqlite.pragma("foreign_keys = ON");

  // 切换 WAL 需要独占，已有其他连接时会立刻 BUSY：先查再切 + 重试
  const mode = sqlite.pragma("journal_mode", { simple: true }) as string;
  if (mode !== "wal") {
    withRetry("journal_mode=WAL", () => sqlite.pragma("journal_mode = WAL"));
  }

  withRetry("migrate", () => migrate(sqlite));
  g.__jluaiSqlite = sqlite;
  withRetry("seed", () => seedIfEmpty(drizzle(sqlite, { schema })));
  return sqlite;
}

/** 建表 DDL（幂等）。schema 变更时在此追加 ALTER/新表。 */
function migrate(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      avatar TEXT NOT NULL DEFAULT '🎓',
      bio TEXT NOT NULL DEFAULT '',
      exp INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS posts (
      number INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      images TEXT,
      topics TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'post',
      location TEXT NOT NULL DEFAULT '吉林',
      pinned INTEGER NOT NULL DEFAULT 0,
      views INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS posts_created_idx ON posts(created_at);
    CREATE INDEX IF NOT EXISTS posts_author_idx ON posts(author_id);
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_number INTEGER NOT NULL REFERENCES posts(number) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id),
      parent_id TEXT,
      content TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '吉林',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS comments_post_idx ON comments(post_number);
    CREATE TABLE IF NOT EXISTS post_likes (
      post_number INTEGER NOT NULL REFERENCES posts(number) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (post_number, user_id)
    );
    CREATE TABLE IF NOT EXISTS comment_likes (
      comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (comment_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS favorites (
      post_number INTEGER NOT NULL REFERENCES posts(number) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (post_number, user_id)
    );
    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (follower_id, followee_id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      post_number INTEGER REFERENCES posts(number) ON DELETE CASCADE,
      comment_id TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at);
    CREATE TABLE IF NOT EXISTS checkins (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, date)
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS chat_created_idx ON chat_messages(created_at);
  `);
}

export const sqlite = connect();
export const db = drizzle(sqlite, { schema });
