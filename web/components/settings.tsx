"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Settings } from "@/lib/types";

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ value, children }: { value: Settings; children: ReactNode }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const s = useContext(SettingsContext);
  if (!s) throw new Error("SettingsProvider missing");
  return s;
}
