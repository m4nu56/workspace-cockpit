"use client";

import Link from "next/link";
import { Copy, History, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { resumeSession, terminalAtSession } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { compact, tilde, withinFolder } from "@/lib/format";
import { folderLink } from "@/lib/home";
import type { Session, SessionDetail } from "@/lib/types";
import { Markdown } from "./markdown";
import { dateTime, sessionTitle } from "./session-tree";
import { useSettings } from "./settings";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return <div className="rounded-md border px-3 py-2"><div className="font-semibold tabular-nums">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}

export function SessionPanel({ session, tracked, onClose }: { session: Session | null; tracked: string[]; onClose: () => void }) {
  const settings = useSettings();
  const [detail, setDetail] = useState<{ id: string; data?: SessionDetail; error?: string } | null>(null);
  const id = session?.id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/sessions/${encodeURIComponent(id)}`).then(async (r) => {
      const body = await r.json();
      if (!cancelled) setDetail(r.ok ? { id, data: body as SessionDetail } : { id, error: (body as { error?: string }).error ?? `HTTP ${r.status}` });
    }).catch((e: unknown) => { if (!cancelled) setDetail({ id, error: String(e) }); });
    return () => { cancelled = true; };
  }, [id]);

  const current = detail?.id === id ? detail : null;
  const d = current?.data;
  const act = async (action: typeof resumeSession) => { if (!session) return; const r = await action(session.id); if (!r.ok) toast.error(r.error); };

  return (
    <Sheet open={!!session} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex flex-col data-[side=right]:w-[min(900px,95vw)] data-[side=right]:sm:max-w-none">
        {session && (
          <>
            <SheetHeader>
              <SheetTitle>{sessionTitle(session)}</SheetTitle>
              <SheetDescription className="space-y-1">
                <span className="block font-mono text-xs">{tilde(session.cwd, settings.home)}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={session.open ? (session.state === "busy" ? "text-emerald-600" : "text-amber-600") : ""}>
                    {!session.open ? "closed" : session.state === "busy" ? "working" : "open, idle"}{session.name && ` · ${session.name}`}{session.pid && ` · pid ${session.pid}`}
                  </span>
                  <button className="inline-flex items-center gap-1 font-mono hover:text-foreground" title="Copy the id"
                    onClick={() => { void navigator.clipboard.writeText(session.id); toast.success("Id copied"); }}>
                    {session.id} <Copy className="size-3" />
                  </button>
                </span>
              </SheetDescription>
              {settings.terminal !== "none" && (
                <div className="flex gap-2 pt-1">
                  {!session.open && <Button size="sm" className="gap-1" onClick={() => act(resumeSession)}><History className="size-4" /> Resume</Button>}
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => act(terminalAtSession)}><Terminal className="size-4" /> Terminal here</Button>
                </div>
              )}
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-6">
              <p className="text-xs text-muted-foreground tabular-nums">
                {dateTime(session.start)} → {dateTime(session.end)}{session.branch && ` · branch ${session.branch}`}{d?.model && ` · ${d.model}`}
              </p>
              {!current ? <p className="text-sm text-muted-foreground">Reading the transcript…</p>
                : current.error ? <p className="text-sm text-red-600">{current.error}</p>
                : d && (
                  <>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      <Figure value={String(d.prompts.length)} label="prompts" />
                      <Figure value={String(d.replies)} label="replies" />
                      <Figure value={String(d.subagents)} label="subagents" />
                      <Figure value={compact(d.tokens.output)} label="output tokens" />
                      <Figure value={compact(d.tokens.input + d.tokens.cache_write)} label="input tokens (uncached)" />
                      <Figure value={compact(d.tokens.cache_read)} label="read from cache" />
                    </div>
                    <Section title={`Your prompts (${d.prompts.length})`}>
                      <ol className="space-y-2">
                        {d.prompts.map((p, i) => (
                          <li key={i} className="rounded-md border-l-2 border-sky-500 bg-muted/40 px-3 py-2">
                            <div className="mb-1 text-xs text-muted-foreground tabular-nums">{i + 1}. {dateTime(p.timestamp)}</div>
                            <p className="whitespace-pre-wrap break-words text-sm">{p.text}</p>
                          </li>
                        ))}
                      </ol>
                    </Section>
                    {d.links.length > 0 && (
                      <Section title="GitHub pull requests and issues">
                        <ul className="space-y-0.5 text-sm">{d.links.map((l) => (
                          <li key={l}><a href={l} target="_blank" rel="noreferrer" className="font-mono text-xs text-sky-600 hover:underline">{l.replace("https://github.com/", "")}</a></li>
                        ))}</ul>
                      </Section>
                    )}
                    <Section title={`Edited files (${d.files.length})`}>
                      <p className="text-xs text-muted-foreground">Files written through the Edit / Write tools only: what a shell command wrote is not listed.</p>
                      {d.files.length > 0 && (
                        <ul className="divide-y rounded-md border text-xs">{d.files.map((f) => {
                          const target = withinFolder(f.path, tracked);
                          return (
                            <li key={f.absolute} className="flex items-center gap-3 px-2 py-1">
                              {target
                                ? <Link href={`${folderLink(target.folder)}?file=${encodeURIComponent(target.file)}`} className="min-w-0 flex-1 truncate font-mono text-sky-600 hover:underline">{f.path}</Link>
                                : <span className="min-w-0 flex-1 truncate font-mono">{f.path}</span>}
                              <span className="shrink-0 text-muted-foreground tabular-nums">{f.edits}×</span>
                            </li>
                          );
                        })}</ul>
                      )}
                    </Section>
                    {d.last_reply && <Section title="Last reply"><div className="rounded-md border p-3"><Markdown text={d.last_reply} /></div></Section>}
                    <Section title="Tools used">
                      <div className="flex flex-wrap gap-1.5">{Object.entries(d.tools).map(([name, n]) => (
                        <span key={name} className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">{name} <span className="text-muted-foreground">{n}</span></span>
                      ))}</div>
                    </Section>
                  </>
                )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
