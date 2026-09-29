import "server-only";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { CalendarEntry, Folder, FolderPage, SearchResult, Session, SessionDetail, Settings, Todo } from "./types";

const run = promisify(execFile);
const LIST_CACHE_MS = 5_000;
let listCache: { at: number; list: Folder[] } | null = null;
let settingsCache: Settings | null = null;

export class CockpitError extends Error {}

// bin/cockpit exports COCKPIT_HOME (repository root) and COCKPIT_CONFIG; `npm run dev` from web/ falls back to "..".
const home = () => process.env.COCKPIT_HOME ?? path.resolve(process.cwd(), "..");
const python = () => process.env.PYTHON ?? "python3";

/** Runs the Python CLI (all workspace rules live there); refusals come back as {"error"} with exit code 1. */
export async function cli<T>(args: string[]): Promise<T> {
  try {
    const { stdout } = await run(python(), ["-m", "cockpit", ...args], {
      cwd: home(), timeout: 60_000, maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, PYTHONPATH: [home(), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) },
    });
    return JSON.parse(stdout) as T;
  } catch (e) {
    const out = (e as { stdout?: string }).stdout;
    let message = e instanceof Error ? e.message : String(e);
    if (out) {
      try { message = (JSON.parse(out) as { error?: string }).error ?? message; } catch { /* not JSON: keep the process error */ }
    }
    throw new CockpitError(message);
  }
}

export async function settings(): Promise<Settings> {
  settingsCache ??= await cli<Settings>(["config"]);
  return settingsCache;
}

export async function listFolders(): Promise<Folder[]> {
  if (listCache && Date.now() - listCache.at < LIST_CACHE_MS) return listCache.list;
  const list = await cli<Folder[]>(["list"]);
  listCache = { at: Date.now(), list };
  return list;
}

export function invalidate(): void { listCache = null; }
export const listTodos = () => cli<Todo[]>(["todo"]);
export const showFolder = (p: string) => cli<FolderPage>(["show", p]);
export const search = (text: string) => cli<{ results: SearchResult[]; truncated: boolean }>(["search", "--", text]);
export const calendar = () => cli<CalendarEntry[]>(["calendar"]);
export const sessions = () => cli<Session[]>(["sessions"]);
export const sessionDetail = (id: string) => cli<SessionDetail>(["session", id]);
