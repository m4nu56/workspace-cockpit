"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Folder, History, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { resumeSession, terminalAtSession } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { relativeAge } from "@/lib/format";
import { fold, folderLink } from "@/lib/home";
import { buildTree, filterSessions, type Node, type SessionPeriod } from "@/lib/tree";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SessionPanel } from "./session-panel";
import { useSettings } from "./settings";

const REFRESH_MS = 10_000;
const VISIBLE_PER_FOLDER = 5;

export const dateTime = (iso: string | null) => iso
  ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "—";

function duration(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const minutes = Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
  return `${Math.floor(minutes / 60 / 24)} d`;
}

export const sessionTitle = (s: Session) => s.title || s.first_prompt || s.last_prompt || "(untitled)";

function Dot({ s }: { s: Session }) {
  const label = !s.open ? "closed" : s.state === "busy" ? "working" : "open, idle";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label={label} className={cn("mt-1.5 inline-block size-2.5 shrink-0 rounded-full",
          !s.open ? "bg-muted-foreground/30" : s.state === "busy" ? "animate-pulse bg-emerald-500" : "bg-amber-400")} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SessionRow({ s, now, onOpen, canTerminal }: { s: Session; now: number; onOpen: (id: string) => void; canTerminal: boolean }) {
  const act = async (action: typeof resumeSession) => { const r = await action(s.id); if (!r.ok) toast.error(r.error); };
  const title = sessionTitle(s);
  return (
    <li className="group flex items-start gap-3 py-2 pr-2">
      <Dot s={s} />
      <button className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => onOpen(s.id)}>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium group-hover:underline">{title}</span>
          {s.name && <span className="font-mono text-xs text-muted-foreground">{s.name}{s.pid ? ` · pid ${s.pid}` : ""}</span>}
        </div>
        {s.last_prompt && s.last_prompt !== title && <p className="truncate text-xs text-muted-foreground">↳ {s.last_prompt}</p>}
        <p className="text-xs text-muted-foreground tabular-nums">
          {dateTime(s.start)} · {s.end ? relativeAge(Date.parse(s.end) / 1000, now) : "—"}
          {duration(s.start, s.end) && ` · ${duration(s.start, s.end)}`} · {s.prompts} prompt(s){s.branch && s.branch !== "HEAD" ? ` · ${s.branch}` : ""}
        </p>
      </button>
      {canTerminal && (
        <div className="flex shrink-0 gap-1 opacity-50 transition-opacity group-hover:opacity-100">
          {!s.open && <Button variant="outline" size="sm" className="h-7 gap-1" onClick={() => act(resumeSession)}><History className="size-3.5" /> Resume</Button>}
          <Button variant="ghost" size="icon" className="size-7" aria-label="Terminal in this folder" onClick={() => act(terminalAtSession)}><Terminal className="size-4" /></Button>
        </div>
      )}
    </li>
  );
}

interface TreeProps { collapsed: Set<string>; toggle: (p: string) => void; tracked: Set<string>; now: number; onOpen: (id: string) => void; canTerminal: boolean }

function FolderNode({ node, depth, ...props }: { node: Node; depth: number } & TreeProps) {
  const closed = props.collapsed.has(node.path);
  const [all, setAll] = useState(false);
  // Open sessions always show; closed ones beyond the most recent few sit behind "+ n more".
  const visible = all ? node.sessions : node.sessions.filter((s, i) => s.open || i < VISIBLE_PER_FOLDER);
  const hidden = node.sessions.length - visible.length;
  return (
    <div className={cn(depth > 0 && "ml-4 border-l pl-3")}>
      <div className="flex items-center gap-1.5 py-1">
        <button onClick={() => props.toggle(node.path)} className="flex items-center gap-1.5 text-left" aria-expanded={!closed}>
          {closed ? <ChevronRight className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
          <Folder className="size-4 text-muted-foreground" />
          <span className="font-mono text-sm font-medium">{node.name}</span>
        </button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {node.total} session(s){node.open > 0 && <span className="text-emerald-600 dark:text-emerald-400"> · {node.open} open</span>}
          {node.latest && ` · ${relativeAge(Date.parse(node.latest) / 1000, props.now)}`}
        </span>
        {props.tracked.has(node.path) && <Link href={folderLink(node.path)} className="text-xs text-sky-600 hover:underline">folder page</Link>}
      </div>
      {!closed && (
        <div className="ml-2">
          {node.children.map((c) => <FolderNode key={c.path} node={c} depth={depth + 1} {...props} />)}
          {node.sessions.length > 0 && (
            <div className="ml-4 border-l pl-3">
              {node.children.length > 0 && <div className="pt-1 text-xs text-muted-foreground">Started in <code>{node.path || node.name}</code> itself</div>}
              <ul className="divide-y">{visible.map((s) => <SessionRow key={s.id} s={s} now={props.now} onOpen={props.onOpen} canTerminal={props.canTerminal} />)}</ul>
              {hidden > 0 && <button className="py-1 text-xs text-sky-600 hover:underline" onClick={() => setAll(true)}>+ {hidden} more</button>}
              {all && node.sessions.length > VISIBLE_PER_FOLDER && <button className="py-1 text-xs text-muted-foreground hover:underline" onClick={() => setAll(false)}>Show less</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SessionTree({ initial, tracked, initialNow }: { initial: Session[]; tracked: string[]; initialNow: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const settings = useSettings();
  const [sessions, setSessions] = useState(initial);
  const [now, setNow] = useState(initialNow);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const period = (params.get("period") ?? "all") as SessionPeriod;
  const openOnly = params.get("open") === "1";

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const r = await fetch("/api/sessions");
        if (r.ok) { setSessions(await r.json()); setNow(Date.now()); }
      } catch { /* next tick */ }
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const toggle = (p: string) => setCollapsed((c) => { const n = new Set(c); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  const pattern = fold(text.trim());
  const visible = filterSessions(sessions, period, openOnly, now)
    .filter((s) => !pattern || fold(`${s.title} ${s.first_prompt} ${s.last_prompt} ${s.name} ${s.folder}`).includes(pattern));
  const rootName = settings.root.split("/").filter(Boolean).at(-1) ?? "workspace";
  const tree = buildTree(visible, rootName);
  const openCount = sessions.filter((s) => s.open).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex gap-1">
          {([["7", "7 days"], ["30", "30 days"], ["all", "All history"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => change("period", v === "all" ? "" : v)}
              className={cn("rounded-md px-2 py-1 text-sm", period === v ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>
        <button onClick={() => change("open", openOnly ? "" : "1")}
          className={cn("rounded-md px-2 py-1 text-sm", openOnly ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>Open only ({openCount})</button>
        <Input className="max-w-xs" placeholder="Filter title, prompt, name…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="ml-auto flex gap-2 text-xs">
          <button className="text-muted-foreground hover:text-foreground" onClick={() => setCollapsed(new Set())}>Expand all</button>
          <button className="text-muted-foreground hover:text-foreground" onClick={() => {
            const all = new Set<string>();
            const walk = (n: Node) => { if (n.path) all.add(n.path); n.children.forEach(walk); };
            walk(tree);
            setCollapsed(all);
          }}>Collapse all</button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {visible.length} session(s) · <span className="text-emerald-600">●</span> working · <span className="text-amber-500">●</span> open, idle ·
        <span className="text-muted-foreground/50"> ●</span> closed. Refreshed every 10 s.
        {settings.terminal !== "none" && <> “Resume” opens a terminal tab in the session&apos;s folder with <code>{settings.agent_command} --resume</code>.</>}
      </p>
      {visible.length ? (
        <div className="rounded-lg border p-3">
          <FolderNode node={tree} depth={0} collapsed={collapsed} toggle={toggle} tracked={new Set(tracked)} now={now}
            onOpen={(id) => change("s", id)} canTerminal={settings.terminal !== "none"} />
        </div>
      ) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No session.</p>}
      <SessionPanel session={sessions.find((s) => s.id === params.get("s")) ?? null} tracked={tracked} onClose={() => change("s", "")} />
    </div>
  );
}
