import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const directory = filename === "Reflector.js"
    ? "examples/jsm/objects"
    : filename === "three.module.js" || filename === "three.core.js" ? "build" : null;
  if (!directory) {
    return new Response(null, { status: 404 });
  }
  const path = join(process.cwd(), "node_modules/three", directory, filename);
  return new Response(await readFile(path), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
