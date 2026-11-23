// Server side of the calendar: events, productions and staff assignments arrive with the page
// (same API and checks as the browser; if any fails, the browser loads them itself).
import { serverApi } from "@/lib/serverApi";
import CalendarView, { type CalEvent, type StaffAssignment } from "./CalendarView";

export default async function CalendarPage() {
  const [events, productions, assignments] = await Promise.all([
    serverApi<CalEvent[]>("/api/calendar"),
    serverApi<unknown[]>("/api/productions"),
    serverApi<StaffAssignment[]>("/api/staff-assignments"),
  ]);
  // Staff assignments are staff-only, so a freelancer gets null there: that's expected, not a failure
  const ok = Array.isArray(events) && Array.isArray(productions);
  return <CalendarView initial={ok ? { events: events!, productions: productions!, assignments: Array.isArray(assignments) ? assignments : [] } : null} />;
}
