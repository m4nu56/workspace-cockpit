import { connection } from "next/server";
import { Suspense } from "react";
import { FilterableList } from "@/components/filterable-list";
import { listFolders } from "@/lib/cockpit";
import { requestTime } from "@/lib/time";

export default async function AllPage() {
  await connection();
  const folders = await listFolders();
  return <Suspense><FilterableList folders={folders} now={requestTime()} /></Suspense>;
}
