import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const exec = promisify(execFile);

describe("SSH 发布切换", () => {
  it.each(["healthy", "failed", "directory"])("%s：切换成功或保留旧代码", async mode => {
    const dir = await mkdtemp(path.join(tmpdir(), "jluai-release-"));
    try {
      const bin = path.join(dir, "bin");
      const old = path.join(dir, "releases/old");
      const release = path.join(dir, "releases/new");
      await mkdir(bin);
      await mkdir(old, { recursive: true });
      await mkdir(release);
      const current = path.join(dir, "src");
      if (mode === "directory") await mkdir(current);
      else await symlink(old, current);
      const commands: Record<string, string> = {
        chown: "#!/bin/sh\nexit 0\n",
        // 服务器使用 GNU mv；Node rename 在 macOS 测试环境中保持同样的原子替换语义。
        mv: `#!${process.execPath}\nrequire('node:fs').renameSync(process.argv.at(-2),process.argv.at(-1));\n`,
        curl: "#!/bin/sh\nexit 0\n",
        systemctl: mode === "failed"
          ? '#!/bin/sh\nif [ ! -e "$RESTART_MARKER" ]; then touch "$RESTART_MARKER"; exit 1; fi\nexit 0\n'
          : "#!/bin/sh\nexit 0\n",
      };
      for (const [name, text] of Object.entries(commands)) {
        await writeFile(path.join(bin, name), text, { mode: 0o755 });
      }
      const source = await readFile("deploy.sh", "utf8");
      const remote = source.split("<<'REMOTE'\n")[1].split("\nREMOTE")[0].replaceAll("/opt/jluai", dir);
      const script = path.join(dir, "remote.sh");
      await writeFile(script, remote);
      const task = exec("bash", [script, "new"], {
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RESTART_MARKER: path.join(dir, "restarted") },
      });
      if (mode === "healthy") {
        await task;
        expect(await readlink(current)).toBe(release);
      } else {
        await expect(task).rejects.toMatchObject({ code: 1 });
        if (mode === "failed") expect(await readlink(current)).toBe(old);
      }
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
