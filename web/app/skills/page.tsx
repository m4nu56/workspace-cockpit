import { connection } from "next/server";
import { Suspense } from "react";
import { SkillList } from "@/components/skill-list";
import { listSkills } from "@/lib/cockpit";

export default async function SkillsPage() {
  await connection();
  const groups = await listSkills();
  const total = groups.reduce((n, g) => n + g.skills.length, 0);
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Skills <span className="font-normal tabular-nums text-muted-foreground">· {total}</span></h1>
        <p className="text-sm text-muted-foreground">
          Claude Code skills of the workspace, its folders, <code>skill_dirs</code>, your personal skills and the enabled plugins.
          The summary comes from the <code>summary:</code> frontmatter field; in italics, it is the first sentence of the description.
        </p>
      </div>
      <Suspense><SkillList groups={groups} /></Suspense>
    </div>
  );
}
