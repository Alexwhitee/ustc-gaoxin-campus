// 每个测试文件独立临时数据库，在导入 lib/db 之前生效
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "jluai-test-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
