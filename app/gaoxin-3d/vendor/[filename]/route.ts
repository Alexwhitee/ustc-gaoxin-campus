import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const vendors = new Map([
  ["three.module.js", "build"], ["three.core.js", "build"],
  ["Reflector.js", "examples/jsm/objects"], ["GLTFLoader.js", "examples/jsm/loaders"],
  ["BufferGeometryUtils.js", "examples/jsm/utils"],
]);

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const directory = vendors.get(filename);
  if (!directory) {
    return new Response(null, { status: 404 });
  }
  const path = join(process.cwd(), "node_modules/three", directory, filename);
  const source = await readFile(path, "utf8");
  return new Response(filename === "GLTFLoader.js" ? source.replace("../utils/BufferGeometryUtils.js", "./BufferGeometryUtils.js") : source, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
