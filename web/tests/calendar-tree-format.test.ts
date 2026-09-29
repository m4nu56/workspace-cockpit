import { describe, expect, it } from "vitest";
import { addMonths, byDay, monthGrid, position, rangeStart, ticks } from "@/lib/calendar";
import { compact, relativeAge, withinFolder } from "@/lib/format";
import { buildTree, filterSessions } from "@/lib/tree";
import type { CalendarEntry, Session } from "@/lib/types";

const e = (name: string, created: string, days: string[]): CalendarEntry =>
  ({ path: `projects/${name}`, name, collection: "projects", label: "project", archived: false, status: "active", created, activity: 0, days });

describe("calendar", () => {
  it("range start", () => {
    expect(rangeStart("3", "2026-09-28", [])).toBe("2026-07-01");
    expect(rangeStart("12", "2026-09-28", [])).toBe("2025-10-01");
    expect(rangeStart("all", "2026-09-28", [e("a", "2026-03-15", []), e("b", "2025-11-02", [])])).toBe("2025-11-01");
  });
  it("position, clamped, DST-proof", () => {
    expect(position("2026-07-06", "2026-07-01", "2026-07-11")).toBe(0.5);
    expect(position("2025-01-01", "2026-07-01", "2026-07-11")).toBe(0);
    expect(position("2027-01-01", "2026-07-01", "2026-07-11")).toBe(1);
    expect(position("2026-10-26", "2026-10-24", "2026-10-28")).toBe(0.5);
  });
  it("ticks and months", () => {
    expect(ticks("2026-07-01", "2026-09-28").map((t) => t.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
  it("month grid, Monday to Sunday", () => {
    const g = monthGrid("2026-09");
    expect(g[0][0]).toBe("2026-08-31");
    expect(g.at(-1)!.at(-1)).toBe("2026-10-04");
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
  it("by day, a creation day not counted twice", () => {
    const m = byDay([e("a", "2026-09-01", ["2026-09-01", "2026-09-03"]), e("b", "2026-08-10", ["2026-09-03"])]);
    expect(m.get("2026-09-01")!.created.map((x) => x.name)).toEqual(["a"]);
    expect(m.get("2026-09-01")!.modified).toEqual([]);
    expect(m.get("2026-09-03")!.modified.map((x) => x.name)).toEqual(["a", "b"]);
  });
});

const s = (id: string, folder: string, end: string, x: Partial<Session> = {}): Session => ({
  id, cwd: `/w/${folder}`, folder, title: id, first_prompt: "", last_prompt: "", start: end, end, prompts: 1,
  branch: "", open: false, state: null, name: "", pid: null, ...x,
});

describe("session tree", () => {
  it("follows the folder hierarchy and counts recursively", () => {
    const root = buildTree([
      s("a", "", "2026-09-01T00:00:00Z"),
      s("b", "projects/alpha", "2026-09-03T00:00:00Z", { open: true, state: "busy" }),
      s("c", "projects/alpha", "2026-09-05T00:00:00Z"),
      s("d", "projects/beta/sub", "2026-09-02T00:00:00Z"),
      s("e", "tools", "2026-09-04T00:00:00Z"),
    ], "work");
    expect(root.name).toBe("work");
    expect(root.sessions.map((x) => x.id)).toEqual(["a"]);
    expect(root.children.map((n) => n.name)).toEqual(["projects", "tools"]);
    const projects = root.children[0];
    expect(projects.children.map((n) => n.name)).toEqual(["alpha", "beta"]);
    expect(projects.children[0].sessions.map((x) => x.id)).toEqual(["c", "b"]);
    expect(projects.children[1].children[0].path).toBe("projects/beta/sub");
    expect([root.total, projects.total, projects.open]).toEqual([5, 3, 1]);
    expect(root.latest).toBe("2026-09-05T00:00:00Z");
  });
  it("filters by period, open sessions always kept", () => {
    const list = [s("old", "", "2026-08-01T00:00:00Z"), s("recent", "", "2026-09-27T00:00:00Z"), s("open-old", "", "2026-07-01T00:00:00Z", { open: true })];
    const now = Date.parse("2026-09-29T12:00:00Z");
    expect(filterSessions(list, "7", false, now).map((x) => x.id)).toEqual(["recent", "open-old"]);
    expect(filterSessions(list, "all", true, now).map((x) => x.id)).toEqual(["open-old"]);
  });
});

describe("format", () => {
  it("compact", () => {
    expect(compact(29_491_152)).toBe("29.5M");
    expect(compact(197_022)).toBe("197k");
    expect(compact(262)).toBe("262");
  });
  it("withinFolder: most precise folder, never a false prefix", () => {
    const folders = ["projects/alpha", "projects/alpha-bis"];
    expect(withinFolder("projects/alpha/specs/a.md", folders)).toEqual({ folder: "projects/alpha", file: "specs/a.md" });
    expect(withinFolder("projects/alpha-bis/x.md", folders)).toEqual({ folder: "projects/alpha-bis", file: "x.md" });
    expect(withinFolder("/tmp/x", folders)).toBeNull();
  });
  it("relativeAge", () => {
    const now = Date.parse("2026-09-29T12:00:00Z");
    expect(relativeAge(now / 1000, now)).toBe("today");
    expect(relativeAge(now / 1000 - 86_400 * 3, now)).toBe("3 days ago");
  });
});

describe("tilde and ages", () => {
  it("tilde", async () => {
    const { tilde } = await import("@/lib/format");
    expect(tilde("/home/dev/work", "/home/dev")).toBe("~/work");
    expect(tilde("/home/dev", "/home/dev")).toBe("~");
    expect(tilde("/home/devx/work", "/home/dev")).toBe("/home/devx/work");
    expect(tilde("/srv/work", "")).toBe("/srv/work");
  });
  it("singular month", () => {
    const now = Date.parse("2026-09-29T12:00:00Z");
    expect(relativeAge(now / 1000 - 86_400 * 35, now)).toBe("1 month ago");
    expect(relativeAge(now / 1000 - 86_400 * 95, now)).toBe("3 months ago");
  });
});
