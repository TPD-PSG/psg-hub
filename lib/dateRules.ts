// Date rules shared by inductions, equipment checks, the compliance register and the daily
// reminders (audit round 2: these were copied in three or four places). No imports, so tests can
// load it directly.

const DAY = 86400e3;

/** `months` after `from`, end-of-month safe (31 Jan + 1 → 28/29 Feb); null when months is 0. */
export function addMonths(from: Date, months: number): Date | null {
  if (!months || months <= 0) return null;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(from.getUTCDate(), last));
  return d;
}

/** The UK calendar day of a moment, as YYYY-MM-DD. */
export const ukDay = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date(d));

/** Whole UK calendar days from `now` to `d`: 0 on the day itself, negative once it's passed. */
export const daysUntilUk = (d: Date | string, now = new Date()) => Math.round((Date.parse(ukDay(d)) - Date.parse(ukDay(now))) / DAY);

/** "due" when within `soonDays`, "expired" once past, else "valid" (null date = "undated"). */
export function dueState(date: Date | string | null | undefined, soonDays: number, now = new Date()): "valid" | "due" | "expired" | "undated" {
  if (!date) return "undated";
  const left = new Date(date).getTime() - now.getTime();
  return left < 0 ? "expired" : left <= soonDays * DAY ? "due" : "valid";
}
