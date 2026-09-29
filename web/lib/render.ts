// No Node import: used by client components.
export type Render = "markdown" | "html" | "pdf" | "image" | "csv" | "text" | "external";

const BY_EXTENSION: Record<string, Render> = {
  ".md": "markdown", ".html": "html", ".htm": "html", ".pdf": "pdf", ".csv": "csv",
  ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image", ".svg": "image", ".webp": "image",
};
const TEXT = new Set([".txt", ".sql", ".py", ".ts", ".tsx", ".js", ".mjs", ".json", ".log", ".sh", ".yml", ".yaml",
  ".xml", ".java", ".cs", ".go", ".rs", ".rb", ".tsv", ".ps1", ".css", ".plist", ".env", ".ini", ".toml", ".eml", ""]);

export function extension(name: string): string {
  const base = name.slice(name.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}

export function render(name: string): Render {
  const ext = extension(name);
  return BY_EXTENSION[ext] ?? (TEXT.has(ext) ? "text" : "external");
}
