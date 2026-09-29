"use client";

import { Bot, Code, Folder, Terminal } from "lucide-react";
import { toast } from "sonner";
import { openFolder } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Target } from "@/lib/open";
import { useSettings } from "./settings";

export function OpenButtons({ path, compact = false }: { path: string; compact?: boolean }) {
  const settings = useSettings();
  const buttons: { target: Target; label: string; Icon: typeof Folder }[] = [
    { target: "finder", label: "Files", Icon: Folder },
    ...(settings.editor_app ? [{ target: "editor" as const, label: "Editor", Icon: Code }] : []),
    ...(settings.terminal !== "none" ? [
      { target: "terminal" as const, label: "Terminal", Icon: Terminal },
      { target: "agent" as const, label: "Agent here", Icon: Bot },
    ] : []),
  ];
  const go = async (target: Target) => {
    const r = await openFolder(path, target);
    if (!r.ok) toast.error(r.error);
  };
  return (
    <div className="flex gap-1">
      {buttons.map(({ target, label, Icon }) => compact ? (
        <Tooltip key={target}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label={label} onClick={() => go(target)}><Icon className="size-4" /></Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ) : (
        <Button key={target} variant="outline" size="sm" className="gap-1.5" onClick={() => go(target)}><Icon className="size-4" /> {label}</Button>
      ))}
    </div>
  );
}
