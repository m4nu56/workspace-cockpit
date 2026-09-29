import Link from "next/link";
import { relativeAge } from "@/lib/format";
import { folderLink } from "@/lib/home";
import type { Folder } from "@/lib/types";
import { AlertBadges, Due, KindBadge, StatusBadge } from "./badges";
import { OpenButtons } from "./open-buttons";

export function FolderRow({ folder, now }: { folder: Folder; now: number }) {
  return (
    <li className="group flex items-start gap-4 border-b px-2 py-3 last:border-b-0 hover:bg-muted/40">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={folderLink(folder.path)} className="font-mono text-sm font-medium hover:underline">{folder.name}</Link>
          <KindBadge folder={folder} />
          <StatusBadge folder={folder} />
          <AlertBadges folder={folder} except={["due_soon", "overdue"]} />
        </div>
        {folder.summary && <p className="line-clamp-1 text-sm text-muted-foreground">{folder.summary}</p>}
        {(folder.next_step || folder.due) && (
          <p className="text-sm">
            {folder.next_step && <span>→ {folder.next_step}</span>}
            {folder.waiting_on === "someone" && folder.who && <span className="text-muted-foreground"> · waiting on {folder.who}</span>}
            {folder.due && <span className="text-muted-foreground"> · <Due folder={folder} /></span>}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-muted-foreground tabular-nums">{relativeAge(folder.activity, now)}</span>
        <div className="opacity-40 transition-opacity group-hover:opacity-100"><OpenButtons path={folder.path} compact /></div>
      </div>
    </li>
  );
}
