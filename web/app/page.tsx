import { connection } from "next/server";
import { AgentPrompt } from "@/components/agent-prompt";
import { FolderRow } from "@/components/folder-row";
import { listFolders } from "@/lib/cockpit";
import { group } from "@/lib/home";
import { requestTime } from "@/lib/time";
import type { Folder } from "@/lib/types";

function Block({ title, help, folders, now }: { title: string; help: string; folders: Folder[]; now: number }) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">{title} <span className="text-muted-foreground tabular-nums">({folders.length})</span></h2>
        <p className="text-sm text-muted-foreground">{help}</p>
      </div>
      {folders.length
        ? <ul className="rounded-lg border">{folders.map((f) => <FolderRow key={f.path} folder={f} now={now} />)}</ul>
        : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nothing here.</p>}
    </section>
  );
}

export default async function Home() {
  await connection();
  const { waitingOnMe, deadlines, needsCare } = group(await listFolders());
  const now = requestTime();
  return (
    <div className="space-y-8">
      <AgentPrompt />
      <Block title="Waiting on me" help="waiting_on: me, by due date then activity." folders={waitingOnMe} now={now} />
      <Block title="Deadlines" help="Overdue or due soon, for folders waiting on someone else or nobody." folders={deadlines} now={now} />
      <Block title="Needs care" help="No status, invalid header, or header not updated for a while." folders={needsCare} now={now} />
    </div>
  );
}
