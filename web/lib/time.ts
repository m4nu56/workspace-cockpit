import "server-only";

/** Request time, read once per server render (pages are dynamic: connection() is awaited first). */
export function requestTime(): number {
  return Date.now();
}

/** Today's local date (YYYY-MM-DD) at request time. */
export function todayIso(): string {
  return new Date(requestTime()).toLocaleDateString("sv-SE");
}
