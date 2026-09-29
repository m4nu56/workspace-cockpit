import { expect, it } from "vitest";
import { fold, folderLink, group } from "@/lib/home";
import type { Folder } from "@/lib/types";

const f = (name: string, x: Partial<Folder>): Folder => ({
  collection: "projects", label: "project", name, path: `projects/${name}`, archived: false, archive_year: null, header: {},
  activity: 0, alerts: [], created: "", status: "active", summary: "", next_step: "", waiting_on: "", who: "", due: "", updated: "", ...x,
});

it("groups without duplicates, by due date then activity", () => {
  const r = group([
    f("a", { waiting_on: "me", activity: 5 }),
    f("b", { waiting_on: "me", due: "2026-10-01", alerts: ["due_soon"] }),
    f("c", { waiting_on: "someone", due: "2026-09-01", alerts: ["overdue"] }),
    f("e", { waiting_on: "me", status: "done" }),
    f("g", { status: "", alerts: ["no_status"] }),
    f("h", { waiting_on: "me", alerts: ["stale_header"] }),
    f("i", { archived: true, waiting_on: "me" }),
  ]);
  expect(r.waitingOnMe.map((x) => x.name)).toEqual(["b", "a", "h"]);
  expect(r.deadlines.map((x) => x.name)).toEqual(["c"]);
  expect(r.needsCare.map((x) => x.name)).toEqual(["g", "h"]);
});

it("folderLink encodes each segment", () => expect(folderLink("projects/_archive/2026/a b")).toBe("/f/projects/_archive/2026/a%20b"));
it("fold", () => expect(fold("Café")).toBe("cafe"));
