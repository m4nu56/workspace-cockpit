import { connection } from "next/server";
import { Suspense } from "react";
import { SessionTree } from "@/components/session-tree";
import { listFolders, sessions } from "@/lib/cockpit";
import { requestTime } from "@/lib/time";

export default async function SessionsPage() {
  await connection();
  const [initial, folders] = await Promise.all([sessions(), listFolders()]);
  return <Suspense><SessionTree initial={initial} tracked={folders.map((f) => f.path)} initialNow={requestTime()} /></Suspense>;
}
