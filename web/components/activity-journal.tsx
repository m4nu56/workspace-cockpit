"use client";

import Link from "next/link";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActivityDay, ActivitySource, Tone } from "@/lib/activity";
import { cn } from "@/lib/utils";

const FILTERS: { value: ActivitySource | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sessions", label: "Claude sessions" },
  { value: "folders", label: "Folders" },
];
const SOURCE_LABELS: Record<ActivitySource, string> = { sessions: "Session", folders: "Folder" };
const VISIBLE_PER_DAY = 12;
const DOTS: Record<Tone, string> = { success: "bg-emerald-500", info: "bg-zinc-400" };

function dayTitle(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function time(timestamp: string): string {
  // Folder entries only carry a date (placed at noon by the journal): no time to show for them.
  return timestamp.endsWith("T12:00:00") ? "" : new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function ActivityJournal({ days }: { days: ActivityDay[] }) {
  const [filter, setFilter] = useState<ActivitySource | "all">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const visible = days
    .map((d) => ({ ...d, entries: d.entries.filter((e) => filter === "all" || e.source === filter) }))
    .filter((d) => d.entries.length);

  return (
    <section className="space-y-4">
      <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
        <TabsList>{FILTERS.map((f) => <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>)}</TabsList>
      </Tabs>
      {visible.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nothing in this period.</p> : null}
      {visible.map((d) => (
        <div key={d.day} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{dayTitle(d.day)}</h3>
          <ul className="divide-y rounded-lg border">
            {(expanded.has(d.day) ? d.entries : d.entries.slice(0, VISIBLE_PER_DAY)).map((e) => (
              <li key={e.key}>
                <Link href={e.link} className="flex items-start gap-3 px-3 py-2 hover:bg-muted/40">
                  <span className="w-11 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">{time(e.timestamp)}</span>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOTS[e.tone])} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{e.title}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{SOURCE_LABELS[e.source]}</span>
                    </span>
                    <span className="block truncate text-sm">{e.subject}</span>
                    {e.detail ? <span className="block truncate text-xs text-muted-foreground">{e.detail}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {d.entries.length > VISIBLE_PER_DAY && !expanded.has(d.day) ? (
            <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setExpanded((before) => new Set(before).add(d.day))}>
              Show {d.entries.length - VISIBLE_PER_DAY} more
            </button>
          ) : null}
        </div>
      ))}
    </section>
  );
}
