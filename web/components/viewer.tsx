"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { openFile } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { render } from "@/lib/render";
import { Markdown } from "./markdown";

const MAX_CSV_ROWS = 1000;

function csvRows(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.length).slice(0, MAX_CSV_ROWS + 1);
  const head = lines[0] ?? "";
  const sep = (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ";" : ",";
  return lines.map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "")));
}

export function Viewer({ path, file }: { path: string; file: string }) {
  const kind = render(file);
  const url = `/api/file?d=${encodeURIComponent(path)}&f=${encodeURIComponent(file)}`;
  const [text, setText] = useState<{ for: string; content: string | null; truncated: boolean; error?: string } | null>(null);
  const needsText = kind === "markdown" || kind === "csv" || kind === "text";

  useEffect(() => {
    if (!needsText) return;
    let cancelled = false;
    fetch(`${url}&text=1`).then(async (r) => {
      const content = await r.text();
      if (cancelled) return;
      setText(r.ok ? { for: url, content, truncated: r.headers.get("X-Truncated") === "1" } : { for: url, content: null, truncated: false, error: content });
    }).catch((e: unknown) => { if (!cancelled) setText({ for: url, content: null, truncated: false, error: String(e) }); });
    return () => { cancelled = true; };
  }, [url, needsText]);

  const open = async () => { const r = await openFile(path, file); if (!r.ok) toast.error(r.error); };
  const bar = (
    <div className="flex items-center gap-2 border-b pb-2">
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{file}</span>
      <Button size="sm" variant="outline" onClick={open}>Open</Button>
    </div>
  );

  if (kind === "html") return <div className="flex h-full flex-col gap-2">{bar}<iframe sandbox="allow-scripts" src={url} className="min-h-0 flex-1 rounded border bg-white" title={file} /></div>;
  if (kind === "pdf") return <div className="flex h-full flex-col gap-2">{bar}<iframe src={url} className="min-h-0 flex-1 rounded border" title={file} /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  if (kind === "image") return <div className="space-y-2">{bar}<img src={url} alt={file} className="max-w-full" /></div>;
  if (kind === "external") return <div className="space-y-2">{bar}<p className="text-sm text-muted-foreground">No preview for this file type.</p></div>;

  const current = text?.for === url ? text : null;
  return (
    <div className="flex h-full flex-col gap-2">
      {bar}
      {current?.truncated && <p className="text-xs text-amber-700">Truncated at 1 MB — use “Open” to see the whole file.</p>}
      <div className="min-h-0 flex-1 overflow-auto">
        {!current ? <p className="text-sm text-muted-foreground">Loading…</p>
          : current.error !== undefined ? <p className="text-sm text-red-600">{current.error}</p>
          : kind === "markdown" ? <Markdown text={current.content ?? ""} />
          : kind === "csv" ? (
            <table className="text-xs">
              <tbody>{csvRows(current.content ?? "").map((row, i) => (
                <tr key={i} className={i === 0 ? "bg-muted font-medium" : ""}>{row.map((c, j) => <td key={j} className="border px-1.5 py-0.5 whitespace-nowrap">{c}</td>)}</tr>
              ))}</tbody>
            </table>
          ) : <pre className="font-mono text-xs whitespace-pre-wrap">{current.content}</pre>}
      </div>
    </div>
  );
}
