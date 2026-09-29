import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { listFolders, settings } from "@/lib/cockpit";
import { MAX_TEXT_BYTES, MIME_TYPES, isInside, securityHeaders } from "@/lib/files";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const d = url.searchParams.get("d") ?? "";
  const f = url.searchParams.get("f") ?? "";
  if (!(await listFolders()).some((x) => x.path === d)) return new Response("Unknown folder", { status: 404 });
  let folderAbs: string;
  let targetAbs: string;
  try {
    folderAbs = await realpath(path.join((await settings()).root, d));
    targetAbs = await realpath(path.join(folderAbs, f));
  } catch {
    return new Response("File not found", { status: 404 });
  }
  if (!isInside(folderAbs, targetAbs) || !(await stat(targetAbs)).isFile()) return new Response("Forbidden", { status: 403 });
  const raw = await readFile(targetAbs);
  const security = securityHeaders(targetAbs);
  if (url.searchParams.get("text")) {
    const truncated = raw.length > MAX_TEXT_BYTES;
    return new Response(raw.subarray(0, MAX_TEXT_BYTES).toString("utf8"), {
      headers: { ...security, "Content-Type": "text/plain; charset=utf-8", ...(truncated ? { "X-Truncated": "1" } : {}) },
    });
  }
  const type = MIME_TYPES[path.extname(targetAbs).toLowerCase()] ?? "application/octet-stream";
  return new Response(new Uint8Array(raw), { headers: { ...security, "Content-Type": type } });
}
