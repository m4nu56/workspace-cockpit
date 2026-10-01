// Activity tab: turns sessions and folder headers into dated journal entries (pure, no I/O, tested alone).
import { folderLink } from "./home";
import type { Folder, Session } from "./types";

export type ActivitySource = "sessions" | "folders";
export type Tone = "success" | "info";

export interface ActivityEntry {
  key: string; source: ActivitySource; timestamp: string; tone: Tone; title: string; subject: string; detail: string; link: string;
}

export interface ActivityDay { day: string; entries: ActivityEntry[] }

export interface ActivityTiles { sessions: number; prompts: number; foldersUpdated: number; foldersCreated: number }

export interface Activity { tiles: ActivityTiles; days: ActivityDay[] }

export const ACTIVITY_DAYS = 14;
const DAY_MS = 86_400_000;
// Above this many header updates on one day (a bulk clean-up), they become a single entry listing the folders.
const GROUP_THRESHOLD = 3;

/** A folder only has dates, not times: its entries sit at noon of that day, so that they sort within the day. */
export const noon = (date: string) => `${date}T12:00:00`;

function sessionEntry(s: Session): ActivityEntry {
  return { key: `sessions:${s.id}`, source: "sessions", timestamp: s.start!, tone: "info", title: s.open ? "Claude session (open)" : "Claude session",
    subject: s.title || s.first_prompt, detail: [s.folder || "workspace root", `${s.prompts} prompt${s.prompts > 1 ? "s" : ""}`].join(" · "),
    link: `/sessions?s=${s.id}` };
}

function folderEntries(f: Folder): ActivityEntry[] {
  const link = folderLink(f.path);
  const entries: ActivityEntry[] = [];
  if (f.created) entries.push({ key: `folders:${f.path}:created`, source: "folders", timestamp: noon(f.created), tone: "success",
    title: `New ${f.label}`, subject: f.name, detail: f.summary, link });
  if (f.updated && f.updated !== f.created) entries.push({ key: `folders:${f.path}:updated`, source: "folders", timestamp: noon(f.updated),
    tone: "info", title: f.archived ? "Archived" : "Header updated", subject: f.name, detail: f.archived ? f.summary : f.next_step, link });
  return entries;
}

function groupUpdates(day: string, list: ActivityEntry[]): ActivityEntry[] {
  const updates = list.filter((e) => e.key.endsWith(":updated") && e.title === "Header updated");
  if (updates.length <= GROUP_THRESHOLD) return list;
  const group: ActivityEntry = { key: `folders:${day}:updated`, source: "folders", timestamp: noon(day), tone: "info",
    title: `${updates.length} headers updated`, subject: updates.map((e) => e.subject).join(", "), detail: "", link: "/all" };
  // The group takes the place of the first update it replaces, which keeps the day sorted.
  return list.flatMap((e) => (!updates.includes(e) ? [e] : e === updates[0] ? [group] : []));
}

/** Local calendar day (YYYY-MM-DD) of a timestamp. */
function localDay(timestamp: string | Date): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function buildActivity(sessions: Session[], folders: Folder[], now: Date, days: number = ACTIVITY_DAYS): Activity {
  const since = new Date(now.getTime() - days * DAY_MS);
  const week = new Date(now.getTime() - 7 * DAY_MS);
  // Compared by day at the upper end: a folder entry of today sits at noon and must show before noon too.
  const within = (timestamp: string, from: Date) => new Date(timestamp) >= from && localDay(timestamp) <= localDay(now);
  // A session without any prompt (opened then closed) says nothing about what was done.
  const worked = sessions.filter((s) => s.start && s.prompts > 0);

  const entries = [...worked.map(sessionEntry), ...folders.flatMap(folderEntries)]
    .filter((e) => within(e.timestamp, since))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const byDay = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const day = localDay(entry.timestamp);
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }
  for (const [day, list] of byDay) byDay.set(day, groupUpdates(day, list));

  const sessionsThisWeek = worked.filter((s) => within(s.start!, week));
  return {
    days: [...byDay].map(([day, list]) => ({ day, entries: list })),
    tiles: {
      sessions: sessionsThisWeek.length,
      prompts: sessionsThisWeek.reduce((n, s) => n + s.prompts, 0),
      foldersUpdated: folders.filter((f) => f.updated && within(noon(f.updated), week)).length,
      foldersCreated: folders.filter((f) => f.created && within(noon(f.created), week)).length,
    },
  };
}
