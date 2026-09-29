"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createFolder } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { folderLink } from "@/lib/home";
import { cn } from "@/lib/utils";
import { useSettings } from "./settings";

const VALID_NAME = /^[a-z0-9][a-z0-9-]{1,60}$/;

export function NewForm() {
  const router = useRouter();
  const { collections, header_file } = useSettings();
  const [collection, setCollection] = useState(collections[0].dir);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [sending, setSending] = useState(false);
  const nameOk = VALID_NAME.test(name);

  const create = async () => {
    setSending(true);
    const r = await createFolder(collection, name, summary);
    setSending(false);
    if (r.ok) { toast.success(`${r.value.path} created`); router.push(folderLink(r.value.path)); } else toast.error(r.error);
  };

  return (
    <form className="grid max-w-xl gap-4" onSubmit={(e) => { e.preventDefault(); void create(); }}>
      {collections.length > 1 && (
        <div className="flex gap-1">
          {collections.map((c) => (
            <button key={c.dir} type="button" onClick={() => setCollection(c.dir)}
              className={cn("rounded-md border px-3 py-1 text-sm", collection === c.dir ? "border-foreground bg-muted font-medium" : "text-muted-foreground")}>
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="name">Folder name</Label>
        <Input id="name" value={name} placeholder="e.g. website-redesign" onChange={(e) => setName(e.target.value.trim())} />
        <p className={cn("font-mono text-xs", name && !nameOk ? "text-red-600" : "text-muted-foreground")}>
          {name && !nameOk ? "lowercase letters, digits and dashes" : `${collection}/${name || "…"}`}
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="summary">Summary (one sentence)</Label>
        <Textarea id="summary" rows={2} maxLength={300} value={summary} onChange={(e) => setSummary(e.target.value.replace(/[\r\n]+/g, " "))} />
      </div>
      <div><Button type="submit" disabled={!nameOk || !summary.trim() || sending}>{sending ? "Creating…" : "Create"}</Button></div>
      <p className="text-xs text-muted-foreground">Creates the folder and its {header_file} (status active, waiting on me). Nothing else.</p>
    </form>
  );
}
