"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { group } from "@/lib/home";
import type { Folder } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SearchPalette } from "./search-palette";

const TABS = [
  { href: "/", label: "To do" },
  { href: "/all", label: "All" },
  { href: "/calendar", label: "Calendar" },
  { href: "/sessions", label: "Sessions" },
  { href: "/skills", label: "Skills" },
  { href: "/activity", label: "Activity" },
  { href: "/new", label: "New" },
];

export function AppShell({ folders, children }: { folders: Folder[]; children: ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const todo = group(folders).waitingOnMe.length;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="font-semibold tracking-tight">Workspace cockpit</Link>
          <nav className="flex gap-1">
            {TABS.map((tab) => {
              const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
              return (
                <Link key={tab.href} href={tab.href}
                  className={cn("flex items-center rounded-md px-3 py-1.5 text-sm transition-colors",
                    active ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
                  {tab.label}
                  {tab.href === "/" && todo ? <Badge variant="secondary" className="ml-2 tabular-nums">{todo}</Badge> : null}
                </Link>
              );
            })}
          </nav>
          <Button variant="outline" size="sm" className="ml-auto gap-2 text-muted-foreground" onClick={() => setPaletteOpen(true)}>
            Search <Kbd>⌘K</Kbd>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <SearchPalette folders={folders} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
