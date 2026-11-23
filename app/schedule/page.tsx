// Server side of the schedule: performances and production events arrive with the page.
import { serverApi } from "@/lib/serverApi";
import ScheduleView, { type CalEvent } from "./ScheduleView";
import { timedFromProductions } from "@/lib/schedule";

export default async function SchedulePage() {
  const [cal, prods] = await Promise.all([serverApi<CalEvent[]>("/api/calendar"), serverApi<Parameters<typeof timedFromProductions>[0]>("/api/productions")]);
  const initial = Array.isArray(cal) && Array.isArray(prods)
    ? { calEvents: cal.filter(e => e.type === "performance"), timedEvents: timedFromProductions(prods) }
    : null;
  return <ScheduleView initial={initial} />;
}
