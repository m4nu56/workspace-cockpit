export type Alert = "no_status" | "invalid_header" | "stale_header" | "overdue" | "due_soon";

export interface Folder {
  collection: string; label: string; name: string; path: string; archived: boolean; archive_year: string | null;
  header: Record<string, string>; activity: number; alerts: Alert[]; created: string;
  status: string; summary: string; next_step: string; waiting_on: string; who: string; due: string; updated: string;
}

export interface FileInfo { path: string; size: number; mtime: number }
export interface FolderPage { folder: Folder; files: FileInfo[]; truncated: boolean; header_text: string | null }
export interface SearchResult { path: string; name: string; file: string | null; line: number | null; excerpt: string }
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface Settings {
  root: string; home: string; collections: { dir: string; label: string }[]; archive_dir: string; header_file: string;
  stale_after_days: number; due_soon_days: number; terminal: "iterm" | "terminal" | "none";
  editor_app: string; agent_command: string; port: number;
}

export interface CalendarEntry {
  path: string; name: string; collection: string; label: string; archived: boolean; status: string;
  created: string; activity: number; days: string[];
}

export interface Session {
  id: string; cwd: string; folder: string; title: string; first_prompt: string; last_prompt: string;
  start: string | null; end: string | null; prompts: number; branch: string;
  open: boolean; state: string | null; name: string; pid: number | null;
}

export interface SessionDetail {
  id: string; model: string; replies: number; subagents: number;
  prompts: { timestamp: string | null; text: string }[];
  tools: Record<string, number>;
  tokens: { input: number; output: number; cache_read: number; cache_write: number };
  files: { path: string; absolute: string; edits: number }[];
  links: string[];
  last_reply: string;
}
