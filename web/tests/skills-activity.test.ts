import { describe, expect, it } from "vitest";
import { buildActivity } from "@/lib/activity";
import { filterSkills, skillLink } from "@/lib/skill-filter";
import type { Folder, Session, Skill, SkillGroup } from "@/lib/types";

const skill = (name: string, summary: string, description = ""): Skill => ({
  id: `x/${name}`, name, origin: "x", summary, summary_auto: false, description, path: "", files: [], error: null, duplicate: false,
});

const groups: SkillGroup[] = [
  { origin: "workspace", label: "Workspace", skills: [skill("release", "Ship a release"), skill("deploy", "Déploiement en préprod")] },
  { origin: "personal", label: "Personal", skills: [skill("notes", "Meeting notes", "Uses the template")] },
];

describe("filterSkills", () => {
  it("returns everything for an empty query", () => {
    expect(filterSkills(groups, "  ")).toBe(groups);
  });

  it("matches name, summary and description, ignoring accents and case", () => {
    expect(filterSkills(groups, "deploiement PREPROD").map((g) => g.skills.map((s) => s.name))).toEqual([["deploy"]]);
    expect(filterSkills(groups, "template")[0].origin).toBe("personal");
  });

  it("drops groups left empty", () => {
    expect(filterSkills(groups, "release template")).toEqual([]);
  });

  it("encodes each id segment", () => {
    expect(skillLink("plugin:superpowers/brainstorming")).toBe("/skills/plugin%3Asuperpowers/brainstorming");
  });
});

const now = new Date("2026-10-01T18:00:00");

const session = (id: string, start: string | null, prompts: number, extra: Partial<Session> = {}): Session => ({
  id, cwd: "/w", folder: "projects/alpha", title: `Session ${id}`, first_prompt: "first", last_prompt: "last", start, end: start,
  prompts, branch: "main", open: false, state: null, name: "", pid: null, ...extra,
});

const folder = (name: string, created: string, updated: string, extra: Partial<Folder> = {}): Folder => ({
  collection: "projects", label: "project", name, path: `projects/${name}`, archived: false, archive_year: null, header: {},
  activity: 0, alerts: [], created, status: "active", summary: `About ${name}`, next_step: `Next for ${name}`, waiting_on: "",
  who: "", due: "", updated, ...extra,
});

describe("buildActivity", () => {
  it("orders days and entries newest first, skips empty sessions and entries outside the window", () => {
    const activity = buildActivity(
      [session("a", "2026-10-01T09:30:00", 3), session("b", "2026-09-30T08:00:00", 0), session("c", "2026-08-01T08:00:00", 2)],
      [folder("alpha", "2026-09-30", "2026-10-01")],
      now,
    );
    expect(activity.days.map((d) => d.day)).toEqual(["2026-10-01", "2026-09-30"]);
    expect(activity.days[0].entries.map((e) => e.title)).toEqual(["Header updated", "Claude session"]);
    expect(activity.days[1].entries.map((e) => e.title)).toEqual(["New project"]);
    expect(activity.days[0].entries[1].link).toBe("/sessions?s=a");
  });

  it("does not report an update made on the creation day, and names archives", () => {
    const activity = buildActivity([], [folder("same", "2026-09-29", "2026-09-29"), folder("old", "2026-01-01", "2026-09-29", { archived: true })], now);
    expect(activity.days[0].entries.map((e) => `${e.title}:${e.subject}`)).toEqual(["New project:same", "Archived:old"]);
  });

  it("groups a bulk header clean-up into one entry", () => {
    const folders = ["a", "b", "c", "d"].map((n) => folder(n, "2026-01-01", "2026-09-28"));
    const [day] = buildActivity([], folders, now).days;
    expect(day.entries).toHaveLength(1);
    expect(day.entries[0].title).toBe("4 headers updated");
    expect(day.entries[0].subject).toBe("a, b, c, d");
  });

  it("shows a header updated today before noon", () => {
    const morning = new Date("2026-10-01T08:00:00");
    const [day] = buildActivity([], [folder("early", "2026-01-01", "2026-10-01")], morning).days;
    expect(day.day).toBe("2026-10-01");
    expect(buildActivity([], [folder("early", "2026-01-01", "2026-10-01")], morning).tiles.foldersUpdated).toBe(1);
  });

  it("counts the last 7 days in the tiles", () => {
    const activity = buildActivity(
      [session("a", "2026-09-30T10:00:00", 4), session("b", "2026-09-20T10:00:00", 9)],
      [folder("x", "2026-09-29", "2026-09-30"), folder("y", "2026-09-01", "2026-09-10")],
      now,
    );
    expect(activity.tiles).toEqual({ sessions: 1, prompts: 4, foldersUpdated: 1, foldersCreated: 1 });
  });
});
