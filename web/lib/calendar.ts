import type { CalendarEntry, Session } from "./types";

// All date arithmetic in UTC on YYYY-MM-DD strings: no daylight-saving drift.
export type Period = "3" | "6" | "12" | "all";
const DAY_MS = 86_400_000;
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const toDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;
const toIso = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

export function addMonths(key: string, n: number): string {
  const total = +key.slice(0, 4) * 12 + (+key.slice(5, 7) - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function rangeStart(period: Period, today: string, entries: CalendarEntry[]): string {
  if (period === "all") {
    const oldest = entries.reduce((min, e) => (e.created && e.created < min ? e.created : min), today);
    return `${oldest.slice(0, 7)}-01`;
  }
  return `${addMonths(today.slice(0, 7), 1 - Number(period))}-01`;
}

/** Fraction (0..1) of the [start, end] range where day falls, clamped. */
export function position(day: string, start: string, end: string): number {
  const width = toDay(end) - toDay(start);
  if (width <= 0) return 0;
  return Math.min(1, Math.max(0, (toDay(day) - toDay(start)) / width));
}

export function ticks(start: string, end: string): { key: string; label: string; position: number }[] {
  const out = [];
  for (let key = start.slice(0, 7); key <= end.slice(0, 7); key = addMonths(key, 1)) {
    const month = +key.slice(5, 7) - 1;
    out.push({ key, label: month === 0 ? `${SHORT_MONTHS[month]} ${key.slice(0, 4)}` : SHORT_MONTHS[month], position: position(`${key}-01`, start, end) });
  }
  return out;
}

/** Weeks (Monday to Sunday) covering the month, as YYYY-MM-DD. */
export function monthGrid(key: string): string[][] {
  const first = toDay(`${key}-01`);
  const last = toDay(`${addMonths(key, 1)}-01`) - 1;
  const monday = first - ((new Date(first * DAY_MS).getUTCDay() + 6) % 7);
  const weeks: string[][] = [];
  for (let j = monday; j <= last; j += 7) weeks.push(Array.from({ length: 7 }, (_, i) => toIso(j + i)));
  return weeks;
}

export interface DaySummary { created: CalendarEntry[]; modified: CalendarEntry[] }

/** Per day: folders created that day, and folders modified that day (a creation day is not counted twice). */
export function byDay(entries: CalendarEntry[]): Map<string, DaySummary> {
  const days = new Map<string, DaySummary>();
  const day = (j: string) => days.get(j) ?? days.set(j, { created: [], modified: [] }).get(j)!;
  for (const e of entries) {
    if (e.created) day(e.created).created.push(e);
    for (const j of e.days) if (j !== e.created) day(j).modified.push(e);
  }
  return days;
}

/** Local calendar day (YYYY-MM-DD) of an ISO timestamp, "" when missing. */
export function localDay(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("sv-SE") : "";
}

/** Tracked folder containing the session's folder, else the session's own folder ("" = workspace root). */
export function attach(s: Session, tracked: string[]): string {
  return tracked.filter((f) => s.folder === f || s.folder.startsWith(`${f}/`)).sort((a, b) => b.length - a.length)[0] ?? s.folder;
}

/** A session counts on its first day and on its last day of activity (once when they are the same). */
export function sessionsByDay(sessions: Session[]): Map<string, Session[]> {
  const days = new Map<string, Session[]>();
  for (const s of sessions) {
    for (const d of new Set([localDay(s.start), localDay(s.end)])) {
      if (d) days.set(d, [...(days.get(d) ?? []), s]);
    }
  }
  return days;
}
