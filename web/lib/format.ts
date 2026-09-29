/** 29491152 → "29.5M", 197022 → "197k". */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString("en-US");
}

/** Tracked folder containing a workspace-relative path, and the path inside it. */
export function withinFolder(p: string, folders: string[]): { folder: string; file: string } | null {
  const folder = folders.filter((f) => p.startsWith(`${f}/`)).sort((a, b) => b.length - a.length)[0];
  return folder ? { folder, file: p.slice(folder.length + 1) } : null;
}

export function relativeAge(ts: number, now: number): string {
  if (!ts) return "—";
  const n = Math.floor((now - ts * 1000) / 86_400_000);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 30) return `${n} days ago`;
  if (n < 365) return n < 60 ? "1 month ago" : `${Math.floor(n / 30)} months ago`;
  return n < 730 ? "1 year ago" : `${Math.floor(n / 365)} years ago`;
}

/** /home/someone/work → ~/work: shorter, and screenshots do not show the user name. */
export function tilde(p: string, home: string): string {
  if (!home) return p;
  return p === home ? "~" : p.startsWith(`${home}/`) ? `~${p.slice(home.length)}` : p;
}
