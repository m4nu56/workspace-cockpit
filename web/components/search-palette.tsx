"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { folderLink } from "@/lib/home";
import type { Folder } from "@/lib/types";
import { KindBadge, StatusBadge } from "./badges";

export function SearchPalette({ folders, open, onOpenChange }: { folders: Folder[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const sorted = [...folders].sort((a, b) => Number(a.archived) - Number(b.archived) || b.activity - a.activity);
  const go = (href: string) => { onOpenChange(false); setText(""); router.push(href); };

  return (
    <CommandDialog className="sm:max-w-3xl" open={open} onOpenChange={onOpenChange} title="Search" description="A folder, or text inside the files">
      {/* cmdk needs its <Command> root: CommandDialog only renders the dialog. */}
      <Command>
        <CommandInput placeholder="Folder name… or text to search in the files" value={text} onValueChange={setText} />
        <CommandList>
          {text.trim().length >= 2 && (
            <CommandGroup heading="In the files">
              <CommandItem value={`__search__ ${text}`} onSelect={() => go(`/search?q=${encodeURIComponent(text.trim())}`)}>
                Search “{text.trim()}” in every tracked folder
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup heading="Folders">
            {sorted.map((f) => (
              <CommandItem key={f.path} value={`${f.name} ${f.summary} ${f.next_step}`} onSelect={() => go(folderLink(f.path))}>
                <span className="w-64 shrink-0 truncate font-mono text-xs">{f.name}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{f.summary}</span>
                <KindBadge folder={f} />
                <StatusBadge folder={f} />
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandEmpty>No folder.</CommandEmpty>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
