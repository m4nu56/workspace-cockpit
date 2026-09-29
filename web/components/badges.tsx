import { Badge } from "@/components/ui/badge";
import { ALERT_LABELS } from "@/lib/home";
import type { Folder } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUSES: Record<string, string> = { active: "active", paused: "paused", done: "done" };

export function KindBadge({ folder }: { folder: Pick<Folder, "label" | "collection"> }) {
  return <Badge variant="outline">{folder.label}</Badge>;
}

export function StatusBadge({ folder }: { folder: Folder }) {
  if (folder.archived) return <Badge variant="secondary">archived {folder.archive_year}</Badge>;
  return <Badge variant={folder.status === "active" ? "default" : "secondary"}>{STATUSES[folder.status] ?? (folder.status || "no status")}</Badge>;
}

export function AlertBadges({ folder, except = [] }: { folder: Folder; except?: string[] }) {
  return (
    <>
      {folder.alerts.filter((a) => !except.includes(a)).map((a) => (
        <Badge key={a} variant="outline" className={cn(a === "overdue" || a === "invalid_header"
          ? "border-red-400 text-red-600 dark:text-red-400" : "border-amber-400 text-amber-700 dark:text-amber-300")}>
          {ALERT_LABELS[a]}
        </Badge>
      ))}
    </>
  );
}

export function Due({ folder }: { folder: Folder }) {
  if (!folder.due) return null;
  return <span className={cn("tabular-nums", folder.alerts.includes("overdue") && "font-medium text-red-600 dark:text-red-400")}>due {folder.due}</span>;
}
