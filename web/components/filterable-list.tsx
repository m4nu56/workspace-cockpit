"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { fold } from "@/lib/home";
import type { Folder } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FolderRow } from "./folder-row";
import { useSettings } from "./settings";

type Params = Record<"kind" | "status" | "waiting" | "sort" | "q" | "alerts", string>;

function keep(f: Folder, p: Params): boolean {
  if (p.kind && f.collection !== p.kind) return false;
  const status = p.status || "alive";
  if (status === "archived" ? !f.archived : status !== "all" && f.archived) return false;
  if (status === "alive" && !["active", "paused"].includes(f.status)) return false;
  if ((status === "active" || status === "paused") && f.status !== status) return false;
  if (status === "none" && ["active", "paused"].includes(f.status)) return false;
  if (p.waiting === "unset" ? f.waiting_on !== "" : p.waiting && f.waiting_on !== p.waiting) return false;
  if (p.alerts && !f.alerts.length) return false;
  if (p.q) {
    const text = fold(`${f.name} ${f.summary} ${f.next_step} ${f.who}`);
    if (!fold(p.q).split(/\s+/).every((w) => text.includes(w))) return false;
  }
  return true;
}

const SORTS: Record<string, (a: Folder, b: Folder) => number> = {
  activity: (a, b) => b.activity - a.activity,
  due: (a, b) => (a.due || "9999").localeCompare(b.due || "9999") || b.activity - a.activity,
  name: (a, b) => a.name.localeCompare(b.name),
};

export function FilterableList({ folders, now }: { folders: Folder[]; now: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const settings = useSettings();
  const p: Params = {
    kind: search.get("kind") ?? "", status: search.get("status") ?? "", waiting: search.get("waiting") ?? "",
    sort: search.get("sort") ?? "activity", q: search.get("q") ?? "", alerts: search.get("alerts") ?? "",
  };
  const filters: Record<"kind" | "status" | "waiting" | "sort", [string, string][]> = {
    kind: [["", "All"], ...settings.collections.map((c): [string, string] => [c.dir, c.dir])],
    status: [["alive", "Active + paused"], ["active", "Active"], ["paused", "Paused"], ["none", "No status"], ["archived", "Archived"], ["all", "Everything"]],
    waiting: [["", "Any"], ["me", "Me"], ["someone", "Someone"], ["nobody", "Nobody"], ["unset", "Not set"]],
    sort: [["activity", "Activity"], ["due", "Due date"], ["name", "Name"]],
  };
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(search.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const visible = folders.filter((f) => keep(f, p)).sort(SORTS[p.sort] ?? SORTS.activity);

  return (
    <div className="space-y-4">
      <Input placeholder="Filter by name, summary, next step…" defaultValue={p.q} autoFocus onChange={(e) => change("q", e.target.value)} />
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {(Object.keys(filters) as (keyof typeof filters)[]).map((key) => (
          <div key={key} className="flex flex-wrap gap-1">
            {filters[key].map(([value, label]) => {
              const active = (p[key] || (key === "status" ? "alive" : key === "sort" ? "activity" : "")) === value;
              return (
                <button key={value} onClick={() => change(key, value)}
                  className={cn("rounded-md px-2 py-1", active ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
                  {key === "sort" ? `↓ ${label}` : key === "waiting" && value ? `Waiting: ${label}` : label}
                </button>
              );
            })}
          </div>
        ))}
        <button onClick={() => change("alerts", p.alerts ? "" : "1")}
          className={cn("rounded-md px-2 py-1", p.alerts ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>With alerts</button>
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">{visible.length} folder(s)</p>
      <ul className="rounded-lg border">{visible.map((f) => <FolderRow key={f.path} folder={f} now={now} />)}</ul>
    </div>
  );
}
