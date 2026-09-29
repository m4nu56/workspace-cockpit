import { attach, localDay } from "./calendar";
import type { CalendarEntry, Session } from "./types";

export type Display = "folders" | "sessions" | "both";

export interface TimelineRow {
  key: string;                   // tracked folder path, or a session folder ("" = workspace root)
  name: string;
  entry: CalendarEntry | null;   // null: sessions only (a folder that is not tracked, or the "sessions" display)
  sessions: Session[];
  last: string;                  // last day of activity (YYYY-MM-DD)
}

const latest = (days: string[]) => days.reduce((a, b) => (b > a ? b : a), "");

/**
 * Tracked folders keep their row; sessions land on their folder's row, or on an extra row when started outside any
 * tracked folder (only without a collection filter). A tracked folder hidden by the filters hides its sessions.
 */
export function timelineRows(entries: CalendarEntry[], sessions: Session[], tracked: string[], display: Display, kindFilter: string, rootName = "workspace root"): TimelineRow[] {
  const byRow = new Map<string, Session[]>();
  if (display !== "folders") for (const s of sessions) { const k = attach(s, tracked); byRow.set(k, [...(byRow.get(k) ?? []), s]); }
  const known = new Set(tracked);
  const rows: TimelineRow[] = [];
  for (const e of entries) {
    const ss = byRow.get(e.path) ?? [];
    if (display === "sessions" && !ss.length) continue;
    rows.push({ key: e.path, name: e.name, entry: display === "sessions" ? null : e, sessions: ss,
      last: latest([...(display === "sessions" ? [] : [e.days.at(-1) ?? e.created]), ...ss.map((s) => localDay(s.end))]) });
  }
  if (!kindFilter) {
    for (const [key, ss] of byRow) {
      if (!known.has(key)) rows.push({ key, name: key || rootName, entry: null, sessions: ss, last: latest(ss.map((s) => localDay(s.end))) });
    }
  }
  return rows.sort((a, b) => b.last.localeCompare(a.last) || a.name.localeCompare(b.name));
}
