"use client";

import { FolderPlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { actOnTodo, addTodo, promoteTodo } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { folderLink } from "@/lib/home";
import type { Result, Todo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSettings } from "./settings";

const VALID_NAME = /^[a-z0-9][a-z0-9-]{1,60}$/;
const DONE_SHOWN = 5;
type Action = "done" | "undo" | "delete";

function suggestedName(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").split("-").slice(0, 5).join("-").slice(0, 61);
}

function Row({ todo, busy, collection, act, promote }: {
  todo: Todo; busy: boolean; collection: string;
  act: (a: Action, t: Todo) => void;
  promote: (t: Todo, name: string) => void;
}) {
  const [name, setName] = useState<string | null>(null);
  return (
    <li className="group flex items-center gap-3 border-b px-2 py-2 last:border-b-0 hover:bg-muted/40">
      <input type="checkbox" className="size-4 shrink-0 accent-foreground" checked={todo.done} disabled={busy}
        aria-label={todo.done ? "Reopen" : "Mark done"} onChange={() => act(todo.done ? "undo" : "done", todo)} />
      <span className={cn("min-w-0 flex-1 text-sm", todo.done && "text-muted-foreground line-through")}>{todo.text}</span>
      {name !== null ? (
        <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (VALID_NAME.test(name)) promote(todo, name); }}>
          <span className="font-mono text-xs text-muted-foreground">{collection}/</span>
          <Input autoFocus value={name} className="h-7 w-56 font-mono text-xs" aria-invalid={!VALID_NAME.test(name)}
            onChange={(e) => setName(e.target.value.trim())} onKeyDown={(e) => { if (e.key === "Escape") setName(null); }} />
          <Button type="submit" size="sm" disabled={busy || !VALID_NAME.test(name)}>Create</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setName(null)}>Cancel</Button>
        </form>
      ) : (
        <>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{todo.done ? todo.finished : todo.added}</span>
          <div className="flex shrink-0 gap-1 opacity-40 transition-opacity group-hover:opacity-100">
            {!todo.done && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7" aria-label="Turn into a folder" disabled={busy}
                    onClick={() => setName(suggestedName(todo.text))}><FolderPlus className="size-4" /></Button>
                </TooltipTrigger>
                <TooltipContent>Turn into a folder</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" aria-label="Delete" disabled={busy}
                  onClick={() => act("delete", todo)}><Trash2 className="size-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
    </li>
  );
}

export function Inbox({ todos }: { todos: Todo[] }) {
  const router = useRouter();
  const { inbox_file, collections } = useSettings();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  const perform = async <T,>(work: () => Promise<Result<T>>, then?: (v: T) => void) => {
    setBusy(true);
    const r = await work();
    setBusy(false);
    if (!r.ok) { toast.error(r.error); router.refresh(); return; }
    if (then) then(r.value); else router.refresh();
  };

  const add = () => {
    if (!text.trim()) return;
    void perform(() => addTodo(text), () => { setText(""); router.refresh(); });
  };
  const act = (a: Action, t: Todo) => void perform(() => actOnTodo(a, t.n, t.text));
  const promote = (t: Todo, name: string) => void perform(() => promoteTodo(t.n, t.text, name), (f) => {
    toast.success(`${f.path} created`);
    router.push(folderLink(f.path));
  });
  const row = (t: Todo) => (
    <Row key={`${t.n}-${t.text}`} todo={t} busy={busy} collection={collections[0]?.dir ?? ""} act={act} promote={promote} />
  );

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">Inbox <span className="text-muted-foreground tabular-nums">({open.length})</span></h2>
        <p className="text-sm text-muted-foreground">
          Small to-dos that do not deserve a folder, kept in <code>{inbox_file}</code>. Also from the terminal: <code>bin/cockpit todo add &quot;…&quot;</code>.
        </p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input value={text} maxLength={300} placeholder="Something to do… (Enter to add)" disabled={busy}
          onChange={(e) => setText(e.target.value)} />
      </form>
      {open.length > 0 && <ul className="rounded-lg border">{open.map(row)}</ul>}
      {done.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Done ({done.length})</summary>
          <ul className="mt-2 rounded-lg border">{(allDone ? done : done.slice(0, DONE_SHOWN)).map(row)}</ul>
          {done.length > DONE_SHOWN && !allDone && (
            <Button variant="link" size="sm" className="px-0" onClick={() => setAllDone(true)}>Show all</Button>
          )}
        </details>
      )}
    </section>
  );
}
