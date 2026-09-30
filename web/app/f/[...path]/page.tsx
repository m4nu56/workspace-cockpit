import { connection } from "next/server";
import { Suspense } from "react";
import { AgentPrompt } from "@/components/agent-prompt";
import { AlertBadges, KindBadge, StatusBadge } from "@/components/badges";
import { ArchiveButton } from "@/components/archive-button";
import { FileBrowser } from "@/components/file-browser";
import { HeaderForm } from "@/components/header-form";
import { Markdown } from "@/components/markdown";
import { OpenButtons } from "@/components/open-buttons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CockpitError, settings, showFolder } from "@/lib/cockpit";
import { requestTime } from "@/lib/time";
import type { FolderPage } from "@/lib/types";

export default async function FolderView({ params, searchParams }: { params: Promise<{ path: string[] }>; searchParams: Promise<{ file?: string }> }) {
  await connection();
  const { path } = await params;
  const { file } = await searchParams;
  let page: FolderPage;
  try {
    page = await showFolder(path.map(decodeURIComponent).join("/"));
  } catch (e) {
    const message = e instanceof CockpitError ? e.message : String(e);
    return <p className="rounded-lg border border-red-300 p-4 text-sm text-red-600">{message}</p>;
  }
  const { folder, files, truncated, header_text } = page;
  const { header_file } = await settings();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-semibold">{folder.name}</h1>
          <KindBadge folder={folder} />
          <StatusBadge folder={folder} />
          <AlertBadges folder={folder} />
        </div>
        <p className="font-mono text-xs text-muted-foreground">{folder.path}</p>
        <div className="flex flex-wrap items-center gap-2">
          <OpenButtons path={folder.path} />
          <div className="ml-auto"><ArchiveButton folder={folder} /></div>
        </div>
      </div>
      {!folder.archived && <AgentPrompt path={folder.path} />}
      {!folder.archived && <HeaderForm key={JSON.stringify(folder.header)} folder={folder} />}
      <Tabs defaultValue={file ? "files" : "header"}>
        <TabsList>
          <TabsTrigger value="header">{header_file}</TabsTrigger>
          <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="header" className="pt-2">
          {header_text ? <Markdown text={header_text} /> : <p className="text-sm text-muted-foreground">No {header_file} in this folder.</p>}
        </TabsContent>
        <TabsContent value="files" className="pt-2">
          <Suspense><FileBrowser path={folder.path} files={files} truncated={truncated} now={requestTime()} /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
