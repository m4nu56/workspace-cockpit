"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { relativeAge } from "@/lib/format";
import { fold } from "@/lib/home";
import type { FileInfo } from "@/lib/types";
import { Viewer } from "./viewer";

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileBrowser({ path, files, truncated, now }: { path: string; files: FileInfo[]; truncated: boolean; now: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const opened = search.get("file");
  const [filter, setFilter] = useState("");
  const choose = (file: string | null) => {
    const next = new URLSearchParams(search.toString());
    if (file) next.set("file", file); else next.delete("file");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const visible = files.filter((f) => !filter || fold(f.path).includes(fold(filter)));

  return (
    <div className="space-y-3">
      <Input placeholder={`Filter ${files.length} file(s)…`} value={filter} onChange={(e) => setFilter(e.target.value)} />
      {truncated && <p className="text-xs text-amber-700">Limited to the 2,000 most recent files.</p>}
      <ul className="divide-y rounded-lg border text-sm">
        {visible.map((f) => (
          <li key={f.path}>
            <button className="flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-muted/50" onClick={() => choose(f.path)}>
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{f.path}</span>
              <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{size(f.size)}</span>
              <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{relativeAge(f.mtime, now)}</span>
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={!!opened} onOpenChange={(o) => { if (!o) choose(null); }}>
        <SheetContent side="right" className="flex flex-col data-[side=right]:w-[min(1100px,95vw)] data-[side=right]:sm:max-w-none">
          <SheetHeader>
            <SheetTitle className="truncate">{opened?.split("/").at(-1)}</SheetTitle>
            <SheetDescription className="truncate font-mono text-xs">{path}/{opened}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 px-4 pb-4">{opened && <Viewer path={path} file={opened} />}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
