import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const exec = promisify(execFile);
const script = path.resolve("backup-db.sh");

describe("数据库在线备份", () => {
  it("支持带引号和空格的路径，备份包含 WAL 数据并只保留七份", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "jluai-backup-' "));
    const dbPath = path.join(dir, "live.db");
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE probe (value TEXT); INSERT INTO probe VALUES ('persisted')");
    try {
      await writeFile(path.join(dir, "keep-me.db"), "unrelated");
      for (let i = 1; i <= 8; i++) await writeFile(path.join(dir, `jluai-2020010${i}-000000.db`), "old");
      const { stdout } = await exec("bash", [script], {
        env: { ...process.env, DATABASE_PATH: dbPath, BACKUP_DIR: dir },
      });
      const target = stdout.trim();
      const copy = new Database(target, { readonly: true });
      try {
        expect(copy.prepare("SELECT value FROM probe").get()).toEqual({ value: "persisted" });
        expect(copy.pragma("quick_check", { simple: true })).toBe("ok");
        expect(copy.pragma("journal_mode", { simple: true })).toBe("delete");
      } finally { copy.close(); }
      expect((await stat(target)).mode & 0o777).toBe(0o600);
      const files = await readdir(dir);
      expect(files.filter(name => name.startsWith("jluai-") && name.endsWith(".db"))).toHaveLength(7);
      expect(files).toContain("keep-me.db");
      expect(files.some(name => name.includes(".tmp"))).toBe(false);
    } finally {
      db.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("源数据库不存在时失败且保留所有旧备份", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "jluai-backup-fail-"));
    try {
      const name = "jluai-20200101-000000.db";
      await writeFile(path.join(dir, name), "existing");
      await expect(exec("bash", [script], {
        env: { ...process.env, DATABASE_PATH: path.join(dir, "missing.db"), BACKUP_DIR: dir },
      })).rejects.toMatchObject({ code: 1 });
      expect(await readdir(dir)).toEqual([name]);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
