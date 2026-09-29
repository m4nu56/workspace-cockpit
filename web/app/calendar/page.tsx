import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarView } from "@/components/calendar-view";
import { calendar } from "@/lib/cockpit";
import { todayIso } from "@/lib/time";

export default async function CalendarPage() {
  await connection();
  const entries = await calendar();
  return <Suspense><CalendarView entries={entries} today={todayIso()} /></Suspense>;
}
