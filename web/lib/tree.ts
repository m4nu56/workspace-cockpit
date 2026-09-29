import type { Session } from "./types";

export interface Node {
  name: string;
  path: string;          // relative to the workspace root, "" for the root
  sessions: Session[];
  children: Node[];
  total: number;           // sessions in this folder and below
  open: number;
  latest: string;        // most recent activity in this folder and below
}

export type SessionPeriod = "7" | "30" | "all";
const DAY_MS = 86_400_000;

/** Open sessions are always kept, whatever the period. */
export function filterSessions(sessions: Session[], period: SessionPeriod, openOnly: boolean, now: number): Session[] {
  const limit = period === "all" ? -Infinity : now - Number(period) * DAY_MS;
  return sessions.filter((s) => (openOnly ? s.open : s.open || Date.parse(s.end ?? "") >= limit));
}

export function buildTree(sessions: Session[], rootName: string): Node {
  const root: Node = { name: rootName, path: "", sessions: [], children: [], total: 0, open: 0, latest: "" };
  for (const s of sessions) {
    let node = root;
    for (const segment of s.folder.split("/").filter(Boolean)) {
      let child = node.children.find((n) => n.name === segment);
      if (!child) {
        child = { name: segment, path: node.path ? `${node.path}/${segment}` : segment, sessions: [], children: [], total: 0, open: 0, latest: "" };
        node.children.push(child);
      }
      node = child;
    }
    node.sessions.push(s);
  }
  const finish = (n: Node): Node => {
    n.children.sort((a, b) => a.name.localeCompare(b.name)).forEach(finish);
    n.sessions.sort((a, b) => (b.end ?? "").localeCompare(a.end ?? ""));
    n.total = n.sessions.length + n.children.reduce((t, e) => t + e.total, 0);
    n.open = n.sessions.filter((s) => s.open).length + n.children.reduce((t, e) => t + e.open, 0);
    n.latest = [n.sessions[0]?.end ?? "", ...n.children.map((e) => e.latest)].reduce((a, b) => (b > a ? b : a), "");
    return n;
  };
  return finish(root);
}
