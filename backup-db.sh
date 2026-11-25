#!/usr/bin/env bash
# 每日备份 SQLite（better-sqlite3 backup API 保证 WAL 模式下的一致性），保留最近 7 份
# 服务器 crontab 示例：30 3 * * * /opt/jluai/src/backup-db.sh
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
export DATABASE_PATH="${DATABASE_PATH:-/opt/jluai/data/jluai.db}"
export BACKUP_DIR="${BACKUP_DIR:-/opt/jluai/backups}"
cd "$SRC_DIR"
umask 077

node <<'NODE'
const Database = require('better-sqlite3');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

async function main() {
  const dir = process.env.BACKUP_DIR;
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const target = path.join(dir, `jluai-${stamp}-${randomUUID()}.db`);
  const temporary = `${target}.tmp`;
  const db = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
  try {
    await db.backup(temporary);
    const copy = new Database(temporary);
    try {
      if (copy.pragma('quick_check', { simple: true }) !== 'ok') {
        throw new Error('备份完整性校验失败');
      }
      // 让备份成为可直接搬运的单文件，避免遗留临时 WAL/SHM。
      copy.pragma('journal_mode = DELETE');
    } finally {
      copy.close();
    }
    await fs.rename(temporary, target);
  } finally {
    db.close();
    for (const suffix of ['', '-wal', '-shm']) await fs.rm(temporary + suffix, { force: true });
  }

  // 只有新备份成功且校验通过后才轮转，只处理本脚本生成的文件。
  const files = (await fs.readdir(dir))
    .filter(name => /^jluai-\d{8}-\d{6}\.db$|^jluai-\d{17}-[\da-f-]{36}\.db$/.test(name))
    .sort().reverse();
  for (const name of files.slice(7)) await fs.unlink(path.join(dir, name));
  console.log(target);
}

main().catch(error => {
  console.error('备份失败：', error.message);
  process.exitCode = 1;
});
NODE
