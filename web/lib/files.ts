import path from "node:path";

export { render, type Render } from "./render";
export const MAX_TEXT_BYTES = 1024 * 1024;

/** True when targetAbs is strictly inside folderAbs (both already realpath'd by the caller). */
export function isInside(folderAbs: string, targetAbs: string): boolean {
  const rel = path.relative(folderAbs, targetAbs);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

export const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".pdf": "application/pdf",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".webp": "image/webp",
};

const ACTIVE = new Set([".html", ".htm", ".svg"]);

/** Documents that can run script are sandboxed even when opened directly; a PDF is not (Chrome blocks a sandboxed PDF viewer). */
export function securityHeaders(name: string): Record<string, string> {
  const base: Record<string, string> = { "X-Content-Type-Options": "nosniff" };
  return ACTIVE.has(path.extname(name).toLowerCase())
    ? { ...base, "Content-Security-Policy": "sandbox allow-scripts; frame-ancestors 'self'" }
    : { ...base, "Content-Security-Policy": "frame-ancestors 'self'" };
}
