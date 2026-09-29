import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONTH_NAMES, addMonths, attach, byDay, monthGrid, sessionsByDay, type DaySummary } from "@/lib/calendar";
import type { Display } from "@/lib/calendar-rows";
import { folderLink } from "@/lib/home";
import type { CalendarEntry, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

const PER_CELL = 3;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const title = (s: Session) => s.title || s.first_prompt || s.last_prompt || "(untitled)";

export function Month({ entries, sessions, tracked, display, kindFilter, rootName, today, month, day, onMonth, onDay }: {
  entries: CalendarEntry[]; sessions: Session[]; tracked: string[]; display: Display; kindFilter: string; rootName: string;
  today: string; month: string; day: string | null; onMonth: (m: string) => void; onDay: (d: string | null) => void;
}) {
  const key = /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const days: Map<string, DaySummary> = display === "sessions" ? new Map() : byDay(entries);
  // Same rule as the timeline: a session follows its folder's visibility; outside any tracked folder, only without a collection filter.
  const shown = new Set(entries.map((e) => e.path));
  const visibleSessions = display === "folders" ? [] : sessions.filter((s) => {
    const row = attach(s, tracked);
    return tracked.includes(row) ? shown.has(row) : !kindFilter;
  });
  const sessionDays = sessionsByDay(visibleSessions);
  const chosen = day ? { ...(days.get(day) ?? { created: [], modified: [] }), sessions: sessionDays.get(day) ?? [] } : null;
  const empty = !chosen || chosen.created.length + chosen.modified.length + chosen.sessions.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="size-8" aria-label="Previous month" onClick={() => onMonth(addMonths(key, -1))}><ChevronLeft className="size-4" /></Button>
        <h2 className="w-44 text-center font-semibold">{MONTH_NAMES[+key.slice(5, 7) - 1]} {key.slice(0, 4)}</h2>
        <Button variant="outline" size="icon" className="size-8" aria-label="Next month" onClick={() => onMonth(addMonths(key, 1))}><ChevronRight className="size-4" /></Button>
        {key !== today.slice(0, 7) && <Button variant="ghost" size="sm" onClick={() => onMonth(today.slice(0, 7))}>Today</Button>}
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border text-xs">
        {WEEKDAYS.map((d) => <div key={d} className="border-b bg-muted/50 px-2 py-1 font-medium text-muted-foreground">{d}</div>)}
        {monthGrid(key).flat().map((d) => {
          const summary = days.get(d);
          const lines = [
            ...(summary?.created ?? []).map((e) => ({ key: `c${e.path}`, text: `+ ${e.name}`, cls: "font-mono text-emerald-600 dark:text-emerald-400" })),
            ...(summary?.modified ?? []).map((e) => ({ key: `m${e.path}`, text: e.name, cls: "font-mono" })),
            ...(sessionDays.get(d) ?? []).map((s) => ({ key: `s${s.id}`, text: `▸ ${title(s)}`, cls: "text-violet-600 dark:text-violet-400" })),
          ];
          return (
            <button key={d} onClick={() => onDay(lines.length ? d : null)}
              className={cn("flex min-h-24 flex-col items-stretch justify-start border-b border-l p-1.5 text-left hover:bg-muted/40 [&:nth-child(7n+1)]:border-l-0",
                !d.startsWith(key) && "bg-muted/20 text-muted-foreground/60", d === day && "ring-2 ring-inset ring-sky-500")}>
              <div className={cn("mb-1 self-start tabular-nums", d === today && "inline-flex size-5 items-center justify-center rounded-full bg-red-500 text-white")}>{+d.slice(8)}</div>
              {lines.slice(0, PER_CELL).map((l) => <div key={l.key} className={cn("truncate", l.cls)}>{l.text}</div>)}
              {lines.length > PER_CELL && <div className="text-muted-foreground">+{lines.length - PER_CELL} more</div>}
            </button>
          );
        })}
      </div>
      {day && chosen && !empty && (
        <div className="rounded-lg border p-3 text-sm">
          <div className="mb-2 flex items-center">
            <h3 className="font-semibold">{day}</h3>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onDay(null)}>Close</Button>
          </div>
          {([["Created", chosen.created], ["Modified", chosen.modified]] as const).map(([heading, list]) => list.length > 0 && (
            <div key={heading} className="mb-2">
              <div className="text-xs font-medium text-muted-foreground">{heading}</div>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {list.map((e) => <li key={e.path}><Link href={folderLink(e.path)} className="font-mono text-xs hover:underline">{e.name}</Link></li>)}
              </ul>
            </div>
          ))}
          {chosen.sessions.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">Claude Code sessions</div>
              <ul className="mt-1 space-y-0.5">
                {chosen.sessions.map((s) => (
                  <li key={s.id} className="text-xs">
                    <Link href={`/sessions?s=${s.id}`} className="text-violet-600 hover:underline dark:text-violet-400">{title(s)}</Link>
                    <span className="ml-2 font-mono text-muted-foreground">{s.folder || rootName}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
