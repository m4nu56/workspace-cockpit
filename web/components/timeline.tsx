import Link from "next/link";
import { position, rangeStart, ticks, type Period } from "@/lib/calendar";
import { folderLink } from "@/lib/home";
import type { CalendarEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const pct = (f: number) => `${(f * 100).toFixed(3)}%`;

export function Timeline({ entries, today, period }: { entries: CalendarEntry[]; today: string; period: Period }) {
  const start = rangeStart(period, today, entries);
  const last = (e: CalendarEntry) => e.days.at(-1) ?? e.created;
  // Folders with no life inside the range are hidden; the most recently active come first.
  const rows = entries.filter((e) => last(e) >= start).sort((a, b) => last(b).localeCompare(last(a)) || b.created.localeCompare(a.created));
  const months = ticks(start, today);

  return (
    <div className="rounded-lg border">
      <div className="sticky top-14 z-10 flex border-b bg-background/95 text-xs text-muted-foreground">
        <div className="w-64 shrink-0 px-3 py-1.5">{rows.length} folder(s)</div>
        <div className="relative mr-4 flex-1">
          {months.map((m) => <span key={m.key} className="absolute top-1.5 pl-1" style={{ left: pct(m.position) }}>{m.label}</span>)}
        </div>
      </div>
      <ul>
        {rows.map((e) => {
          // Imported files can be older than the folder: the bar starts at whichever comes first.
          const first = e.days[0] && e.days[0] < e.created ? e.days[0] : e.created;
          const left = position(first, start, today);
          const right = position(last(e), start, today);
          return (
            <li key={e.path} className="flex items-center border-b last:border-b-0 hover:bg-muted/40">
              <Link href={folderLink(e.path)} className="w-64 shrink-0 truncate px-3 py-1.5 font-mono text-xs hover:underline" title={e.path}>
                {e.name}<span className="ml-1 text-muted-foreground">· {e.label}</span>
              </Link>
              <div className="relative mr-4 h-7 flex-1">
                {months.map((m) => <span key={m.key} className="absolute inset-y-0 border-l border-dashed border-border" style={{ left: pct(m.position) }} />)}
                <span className="absolute inset-y-0 border-l-2 border-red-400/60" style={{ left: pct(1) }} title="today" />
                <span title={`created ${e.created} · last activity ${last(e)}`}
                  className={cn("absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full",
                    e.archived ? "bg-muted-foreground/20" : e.status === "active" ? "bg-sky-500/40" : "bg-muted-foreground/35")}
                  style={{ left: pct(left), width: `max(0.375rem, ${pct(right - left)})` }} />
                {e.days.filter((d) => d >= start).map((d) => (
                  <span key={d} title={d} className={cn("absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background",
                    e.archived ? "bg-muted-foreground/50" : "bg-sky-600")} style={{ left: pct(position(d, start, today)) }} />
                ))}
                {/* Drawn last: the creation marker stays visible over a same-day modification dot. */}
                {e.created >= start && <span title={`created ${e.created}`} className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-emerald-500 ring-2 ring-background" style={{ left: pct(position(e.created, start, today)) }} />}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-4 border-t px-3 py-1.5 text-xs text-muted-foreground">
        <span><span className="mr-1 inline-block size-2 rotate-45 bg-emerald-500" />created</span>
        <span><span className="mr-1 inline-block size-2 rounded-full bg-sky-600" />day with changes</span>
        <span><span className="mr-1 inline-block h-1.5 w-4 rounded-full bg-sky-500/40" />lifetime (active; grey: paused or archived)</span>
      </div>
    </div>
  );
}
