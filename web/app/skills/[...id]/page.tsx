import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Markdown } from "@/components/markdown";
import { SkillBadges } from "@/components/skill-list";
import { CockpitError, settings, skillDetail } from "@/lib/cockpit";
import { tilde } from "@/lib/format";
import type { SkillDetail } from "@/lib/types";

export default async function SkillPage({ params }: { params: Promise<{ id: string[] }> }) {
  await connection();
  const { id } = await params;
  const { home } = await settings();
  let skill: SkillDetail;
  try {
    skill = await skillDetail(id.map(decodeURIComponent).join("/"));
  } catch (e) {
    if (e instanceof CockpitError) notFound();
    throw e;
  }
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm"><Link href="/skills" className="text-muted-foreground hover:underline">Skills</Link> / <span className="text-muted-foreground">{skill.group}</span></p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-semibold">{skill.name}</h1>
          <SkillBadges skill={skill} />
        </div>
        <p className={skill.summary_auto ? "italic text-muted-foreground" : "text-muted-foreground"}>{skill.summary}</p>
        {skill.error ? <p className="text-sm text-red-600">{skill.error}</p> : null}
      </div>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Description (what triggers it)</h2>
        <p className="whitespace-pre-wrap text-sm">{skill.description || "No description."}</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Files</h2>
        <p className="break-all font-mono text-xs text-muted-foreground">{tilde(skill.path, home)}</p>
        {skill.files.length ? <ul className="font-mono text-xs text-muted-foreground">{skill.files.map((f) => <li key={f}>{f}</li>)}</ul> : null}
      </section>
      <section className="space-y-2 border-t pt-6">
        <h2 className="text-sm font-semibold">SKILL.md</h2>
        <Markdown text={skill.body} />
      </section>
    </div>
  );
}
