import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // lib/ 里的模块用的是 TS path alias 之外的相对导入 + @/ alias
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
});
