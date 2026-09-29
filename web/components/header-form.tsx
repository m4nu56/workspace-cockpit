"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { setHeader } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Folder } from "@/lib/types";
import { cn } from "@/lib/utils";

const FIELDS = ["status", "summary", "next_step", "waiting_on", "who", "due"] as const;
type Field = (typeof FIELDS)[number];

function Choice({ value, options, onChoose }: { value: string; options: [string, string][]; onChoose: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChoose(v)}
          className={cn("rounded-md border px-2.5 py-1 text-sm", value === v ? "border-foreground bg-muted font-medium" : "text-muted-foreground")}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function HeaderForm({ folder }: { folder: Folder }) {
  const router = useRouter();
  const initial = Object.fromEntries(FIELDS.map((k) => [k, folder[k]])) as Record<Field, string>;
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const changed = FIELDS.filter((k) => values[k] !== initial[k]);
  const set = (k: Field, v: string) => setValues((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setSaving(true);
    const r = await setHeader(folder.path, Object.fromEntries(changed.map((k) => [k, values[k]])));
    setSaving(false);
    if (r.ok) { toast.success("Header saved"); router.refresh(); } else toast.error(r.error);
  };

  return (
    <form className="grid gap-4 rounded-lg border p-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="grid gap-1.5">
        <Label>Status</Label>
        <Choice value={values.status} onChoose={(v) => set("status", v)} options={[["active", "Active"], ["paused", "Paused"], ["done", "Done"]]} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="summary">Summary</Label>
        <Input id="summary" value={values.summary} maxLength={300} onChange={(e) => set("summary", e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="next-step">Next step</Label>
        <Textarea id="next-step" rows={2} maxLength={300} value={values.next_step}
          onChange={(e) => set("next_step", e.target.value.replace(/[\r\n]+/g, " "))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr_auto]">
        <div className="grid gap-1.5">
          <Label>Waiting on</Label>
          <Choice value={values.waiting_on} onChoose={(v) => set("waiting_on", v)} options={[["me", "Me"], ["someone", "Someone"], ["nobody", "Nobody"]]} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="who">Who (if someone)</Label>
          <Input id="who" value={values.who} maxLength={300} disabled={values.waiting_on !== "someone" && !values.who} onChange={(e) => set("who", e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="due">Due</Label>
          <div className="flex gap-1">
            <Input id="due" type="date" value={values.due} onChange={(e) => set("due", e.target.value)} />
            {values.due && <Button type="button" variant="ghost" size="sm" onClick={() => set("due", "")}>Clear</Button>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!changed.length || saving}>{saving ? "Saving…" : "Save"}</Button>
        {changed.length > 0 && <Button type="button" variant="ghost" onClick={() => setValues(initial)}>Cancel</Button>}
        <span className="ml-auto text-xs text-muted-foreground">{folder.updated ? `Header updated on ${folder.updated}` : "Header never dated"}</span>
      </div>
    </form>
  );
}
