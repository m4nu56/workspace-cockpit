import type { Alert, Folder } from "./types";

export interface Home { waitingOnMe: Folder[]; deadlines: Folder[]; needsCare: Folder[] }

export const ALERT_LABELS: Record<Alert, string> = {
  no_status: "no status", invalid_header: "invalid header", stale_header: "stale header",
  overdue: "overdue", due_soon: "due soon",
};

const alive = (f: Folder) => !f.archived && (f.status === "active" || f.status === "paused");
const byDue = (a: Folder, b: Folder) => (a.due || "9999").localeCompare(b.due || "9999") || b.activity - a.activity;

export function group(folders: Folder[]): Home {
  const waitingOnMe = folders.filter((f) => alive(f) && f.waiting_on === "me").sort(byDue);
  const deadlines = folders.filter((f) => alive(f) && f.waiting_on !== "me" &&
    f.alerts.some((a) => a === "overdue" || a === "due_soon")).sort(byDue);
  const needsCare = folders.filter((f) => !f.archived &&
    f.alerts.some((a) => a === "no_status" || a === "invalid_header" || a === "stale_header"))
    .sort((a, b) => b.activity - a.activity);
  return { waitingOnMe, deadlines, needsCare };
}

export const folderLink = (p: string) => "/f/" + p.split("/").map(encodeURIComponent).join("/");

export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
