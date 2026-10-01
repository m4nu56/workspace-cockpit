import { connection } from "next/server";
import { ActivityJournal } from "@/components/activity-journal";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVITY_DAYS, buildActivity } from "@/lib/activity";
import { listFolders, sessions } from "@/lib/cockpit";
import { requestTime } from "@/lib/time";

export default async function ActivityPage() {
  await connection();
  // An unreadable Claude Code folder must not hide the folder activity.
  const [allSessions, folders] = await Promise.all([sessions().catch(() => []), listFolders()]);
  const { tiles, days } = buildActivity(allSessions, folders, new Date(requestTime()));
  const cards = [
    { label: "Claude sessions", value: tiles.sessions },
    { label: "Prompts", value: tiles.prompts },
    { label: "Headers updated", value: tiles.foldersUpdated },
    { label: "Folders created", value: tiles.foldersCreated },
  ];
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm text-muted-foreground">Last 7 days.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label} className="gap-1 py-4">
              <CardHeader className="px-4"><CardDescription>{c.label}</CardDescription><CardTitle className="text-2xl tabular-nums">{c.value}</CardTitle></CardHeader>
            </Card>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Journal</h2>
          <p className="text-sm text-muted-foreground">What happened in the workspace over the last {ACTIVITY_DAYS} days.</p>
        </div>
        <ActivityJournal days={days} />
      </section>
    </div>
  );
}
