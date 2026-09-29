import Link from "next/link";
import { connection } from "next/server";
import { search } from "@/lib/cockpit";
import { folderLink } from "@/lib/home";
import type { SearchResult } from "@/lib/types";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await connection();
  const q = ((await searchParams).q ?? "").trim();
  if (q.length < 2) return <p className="text-sm text-muted-foreground">Type at least 2 characters in the search (⌘K).</p>;
  let found: { results: SearchResult[]; truncated: boolean };
  try {
    found = await search(q);
  } catch (e) {
    return <p className="text-sm text-red-600">{e instanceof Error ? e.message : String(e)}</p>;
  }
  const groups = new Map<string, SearchResult[]>();
  for (const r of found.results) groups.set(r.path, [...(groups.get(r.path) ?? []), r]);
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">“{q}” — {found.results.length} result(s) in {groups.size} folder(s)</h1>
      {found.truncated && <p className="text-sm text-amber-700">Limited to the first 200 results: refine the search.</p>}
      {[...groups.entries()].map(([p, list]) => (
        <section key={p} className="space-y-1">
          <Link href={folderLink(p)} className="font-mono text-sm font-medium hover:underline">{p}</Link>
          <ul className="divide-y rounded-lg border text-sm">
            {list.map((r, i) => (
              <li key={i}>
                <Link className="flex gap-3 px-3 py-1.5 hover:bg-muted/50" href={r.file ? `${folderLink(p)}?file=${encodeURIComponent(r.file)}` : folderLink(p)}>
                  <span className="w-72 shrink-0 truncate font-mono text-xs text-muted-foreground">{r.file ? `${r.file}:${r.line}` : "name / summary"}</span>
                  <span className="min-w-0 flex-1 truncate">{r.excerpt}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
