import Link from "next/link";
import { localDay, position, rangeStart, ticks, type Period } from "@/lib/calendar";
import { timelineRows, type Display } from "@/lib/calendar-rows";
import { folderLink } from "@/lib/home";
import type { CalendarEntry, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

const pct = (f: number) => `${(f * 100).toFixed(3)}%`;
const title = (s: Session) => s.title || s.first_prompt || s.last_prompt || "(untitled)";

export function Timeline({ entries, sessions, tracked, display, kindFilter, rootName, today, period }: {
  entries: CalendarEntry[]; sessions: Session[]; tracked: string[]; display: Display; kindFilter: string; rootName: string;
  today: string; period: Period;
}) {
  const start = rangeStart(period, today, entries);
  const rows = timelineRows(entries, sessions, tracked, display, kindFilter, rootName).filter((r) => r.last >= start);
  const months = ticks(start, today);

  return (
    <div className="rounded-lg border">
      <div className="sticky top-14 z-10 flex border-b bg-background/95 text-xs text-muted-foreground">
        <div className="w-64 shrink-0 px-3 py-1.5">{rows.length} row(s)</div>
        <div className="relative mr-4 flex-1">
          {months.map((m) => <span key={m.key} className="absolute top-1.5 pl-1" style={{ left: pct(m.position) }}>{m.label}</span>)}
        </div>
      </div>
      <ul>
        {rows.map((r) => {
          const e = r.entry;
          const last = e ? (e.days.at(-1) ?? e.created) : "";
          // Imported files can be older than the folder: the bar starts at whichever comes first.
          const first = e ? (e.days[0] && e.days[0] < e.created ? e.days[0] : e.created) : "";
          return (
            <li key={r.key || "__root"} className="flex items-center border-b last:border-b-0 hover:bg-muted/40">
              {tracked.includes(r.key)
                ? <Link href={folderLink(r.key)} className="w-64 shrink-0 truncate px-3 py-1.5 font-mono text-xs hover:underline" title={r.key}>
                    {r.name}{e && <span className="ml-1 text-muted-foreground">· {e.label}</span>}
                  </Link>
                : <Link href="/sessions" className="w-64 shrink-0 truncate px-3 py-1.5 font-mono text-xs text-muted-foreground hover:underline" title={`Sessions started in ${r.name}`}>
                    {r.name}<span className="ml-1">· folder</span>
                  </Link>}
              <div className="relative mr-4 h-7 flex-1">
                {months.map((m) => <span key={m.key} className="absolute inset-y-0 border-l border-dashed border-border" style={{ left: pct(m.position) }} />)}
                <span className="absolute inset-y-0 border-l-2 border-red-400/60" style={{ left: pct(1) }} title="today" />
                {e && (
                  <>
                    <span title={`created ${e.created} · last activity ${last}`}
                      className={cn("absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full",
                        e.archived ? "bg-muted-foreground/20" : e.status === "active" ? "bg-sky-500/40" : "bg-muted-foreground/35")}
                      style={{ left: pct(position(first, start, today)), width: `max(0.375rem, ${pct(position(last, start, today) - position(first, start, today))})` }} />
                    {e.days.filter((d) => d >= start).map((d) => (
                      <span key={d} title={d} className={cn("absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background",
                        e.archived ? "bg-muted-foreground/50" : "bg-sky-600")} style={{ left: pct(position(d, start, today)) }} />
                    ))}
                  </>
                )}
                {/* Sessions: a violet stroke at the bottom of the row, from first to last activity. */}
                {r.sessions.filter((s) => localDay(s.end) >= start).map((s) => {
                  const l = position(localDay(s.start), start, today);
                  const w = position(localDay(s.end), start, today) - l;
                  return (
                    <Link key={s.id} href={`/sessions?s=${s.id}`}
                      title={`${title(s)} — ${localDay(s.start)} → ${localDay(s.end)}${s.open ? " (open)" : ""}`}
                      className={cn("absolute bottom-0.5 h-1.5 rounded-sm hover:h-2.5", s.open ? "bg-violet-600" : "bg-violet-500/70")}
                      style={{ left: `calc(${pct(l)} - 0.25rem)`, width: `max(0.5rem, ${pct(w)})` }} />
                  );
                })}
                {e && e.created >= start && <span title={`created ${e.created}`} className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-emerald-500 ring-2 ring-background" style={{ left: pct(position(e.created, start, today)) }} />}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-4 border-t px-3 py-1.5 text-xs text-muted-foreground">
        <span><span className="mr-1 inline-block size-2 rotate-45 bg-emerald-500" />created</span>
        <span><span className="mr-1 inline-block size-2 rounded-full bg-sky-600" />day with changes</span>
        <span><span className="mr-1 inline-block h-1.5 w-4 rounded-full bg-sky-500/40" />lifetime (active; grey: paused or archived)</span>
        <span><span className="mr-1 inline-block h-1.5 w-4 rounded-sm bg-violet-500/70" />Claude Code session (click for details)</span>
      </div>
    </div>
  );
}
