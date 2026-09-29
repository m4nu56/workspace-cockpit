"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { archiveFolder, unarchiveFolder } from "@/app/actions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { folderLink } from "@/lib/home";
import type { Folder } from "@/lib/types";
import { useSettings } from "./settings";

export function ArchiveButton({ folder }: { folder: Folder }) {
  const router = useRouter();
  const { archive_dir } = useSettings();
  const act = async () => {
    const r = folder.archived ? await unarchiveFolder(folder.path) : await archiveFolder(folder.path);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(folder.archived ? "Moved out of the archive (status: paused)" : `Archived to ${r.value.path}`);
    router.push(folderLink(r.value.path));
  };
  const target = folder.archived ? `${folder.collection}/${folder.name}` : `${folder.collection}/${archive_dir}/${new Date().getFullYear()}/${folder.name}`;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="outline" size="sm">{folder.archived ? "Unarchive" : "Archive"}</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{folder.archived ? "Move out of the archive?" : "Archive this folder?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {folder.archived ? "Status becomes “paused”." : "Status becomes “done”."} The folder moves to <code>{target}</code>. Nothing is deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={act}>{folder.archived ? "Unarchive" : "Archive"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
