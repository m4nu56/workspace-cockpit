"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Period } from "@/lib/calendar";
import type { Display } from "@/lib/calendar-rows";
import type { CalendarEntry, Session } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Month } from "./month";
import { useSettings } from "./settings";
import { Timeline } from "./timeline";

function Choice({ options, value, onChoose }: { options: [string, string][]; value: string; onChoose: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChoose(v)}
          className={cn("rounded-md px-2 py-1 text-sm", value === v ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>{label}</button>
      ))}
    </div>
  );
}

export function CalendarView({ entries, sessions, today }: { entries: CalendarEntry[]; sessions: Session[]; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { collections, header_file, root } = useSettings();
  const view = params.get("view") === "month" ? "month" : "timeline";
  const period = (params.get("period") ?? "6") as Period;
  const kind = params.get("kind") ?? "";
  const archives = params.get("archives") === "1";
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const display = (["folders", "sessions"].includes(params.get("show") ?? "") ? params.get("show") : "both") as Display;
  const visible = entries.filter((e) => (!kind || e.collection === kind) && (archives || !e.archived));
  // Sessions attach to any known folder (archived included), so hiding the archive also hides their sessions.
  const tracked = entries.map((e) => e.path);
  const rootName = root.split("/").filter(Boolean).at(-1) ?? "workspace";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Choice options={[["timeline", "Timeline"], ["month", "Month"]]} value={view} onChoose={(v) => change("view", v === "timeline" ? "" : v)} />
        <Choice options={[["both", "Folders + sessions"], ["folders", "Folders"], ["sessions", "Sessions"]]} value={display} onChoose={(v) => change("show", v === "both" ? "" : v)} />
        {view === "timeline" && <Choice options={[["3", "3 months"], ["6", "6 months"], ["12", "12 months"], ["all", "All"]]} value={period} onChoose={(v) => change("period", v === "6" ? "" : v)} />}
        {collections.length > 1 && <Choice options={[["", "All"], ...collections.map((c): [string, string] => [c.dir, c.dir])]} value={kind} onChoose={(v) => change("kind", v)} />}
        <Choice options={[["", "Without archive"], ["1", "With archive"]]} value={archives ? "1" : ""} onChoose={(v) => change("archives", v)} />
      </div>
      <p className="text-xs text-muted-foreground">
        Creation: the folder&apos;s creation date on disk (or <code>created</code> in its {header_file} header). Dots: days on which at least one file
        carries that modification date — a file modified several times only keeps its last modification. Violet strokes:
        Claude Code sessions, from start to last activity, on the folder they were started in.
      </p>
      {view === "timeline"
        ? <Timeline entries={visible} sessions={sessions} tracked={tracked} display={display} kindFilter={kind} rootName={rootName} today={today} period={period} />
        : <Month entries={visible} sessions={sessions} tracked={tracked} display={display} kindFilter={kind} rootName={rootName} today={today} month={params.get("month") ?? today.slice(0, 7)} day={params.get("day")}
            onMonth={(m) => { const s = new URLSearchParams(params.toString()); s.set("month", m); s.delete("day"); router.replace(`${pathname}?${s.toString()}`, { scroll: false }); }}
            onDay={(d) => change("day", d ?? "")} />}
    </div>
  );
}
