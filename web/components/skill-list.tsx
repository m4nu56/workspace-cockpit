"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/components/settings";
import { Input } from "@/components/ui/input";
import { tilde } from "@/lib/format";
import { filterSkills, skillLink } from "@/lib/skill-filter";
import type { Skill, SkillGroup } from "@/lib/types";

export function SkillBadges({ skill }: { skill: Skill }) {
  return (
    <>
      {skill.error ? <Badge variant="destructive" title={skill.error}>invalid frontmatter</Badge> : null}
      {skill.duplicate ? <Badge variant="outline" title="The same name exists in another source">duplicate</Badge> : null}
    </>
  );
}

function SkillRow({ skill }: { skill: Skill }) {
  const settings = useSettings();
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-col gap-1 p-3 hover:bg-muted/50">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium">{skill.name}</span>
            <SkillBadges skill={skill} />
          </span>
          <span className={skill.summary_auto ? "text-sm italic text-muted-foreground" : "text-sm text-muted-foreground"}>{skill.summary || "—"}</span>
        </summary>
        <div className="space-y-3 border-t bg-muted/20 p-4 text-sm">
          {skill.error ? <p className="text-red-600">{skill.error}</p> : null}
          <p className="whitespace-pre-wrap">{skill.description || "No description."}</p>
          <p className="break-all font-mono text-xs text-muted-foreground">{tilde(skill.path, settings.home)}</p>
          {skill.files.length ? <p className="text-xs text-muted-foreground">{skill.files.length} supporting file{skill.files.length > 1 ? "s" : ""}</p> : null}
          <Link href={skillLink(skill.id)} className="underline">Read the SKILL.md</Link>
        </div>
      </details>
    </li>
  );
}

export function SkillList({ groups }: { groups: SkillGroup[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const change = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("q", value); else next.delete("q");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const visible = filterSkills(groups, query);
  return (
    <div className="space-y-6">
      <Input placeholder="Filter by name, summary, description…" defaultValue={query} autoFocus onChange={(e) => change(e.target.value)} />
      {visible.length === 0 ? <p className="text-sm text-muted-foreground">No skill matches.</p> : null}
      {visible.map((g) => (
        <section key={g.origin} className="space-y-2">
          <h2 className="text-sm font-semibold">{g.label} <span className="font-normal tabular-nums text-muted-foreground">· {g.skills.length}</span></h2>
          <ul className="divide-y rounded-md border">{g.skills.map((s) => <SkillRow key={s.id} skill={s} />)}</ul>
        </section>
      ))}
    </div>
  );
}
