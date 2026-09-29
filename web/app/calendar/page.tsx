import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarView } from "@/components/calendar-view";
import { calendar, sessions } from "@/lib/cockpit";
import { todayIso } from "@/lib/time";

export default async function CalendarPage() {
  await connection();
  const [entries, allSessions] = await Promise.all([calendar(), sessions()]);
  return <Suspense><CalendarView entries={entries} sessions={allSessions} today={todayIso()} /></Suspense>;
}
