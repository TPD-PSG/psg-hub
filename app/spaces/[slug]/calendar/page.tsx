// Workshop calendar (TWS workshop director, 28 Nov 2026): every build broken down into its pieces
// and each piece's discipline stages (Pre-production, Technical drawing, CNC, Carpentry…) on dates.
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import { staffPageOrMyWork } from "@/lib/spaceStaffPage";
import WorkshopCalendar, { type CalendarData } from "./WorkshopCalendar";

export default async function CalendarPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string; weeks?: string }> }) {
  const { slug } = await params;
  const { from, weeks } = await searchParams;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  await staffPageOrMyWork(slug); // freelancers work from My work
  const qs = new URLSearchParams();
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) qs.set("from", from);
  if (weeks && /^\d{1,2}$/.test(weeks)) qs.set("weeks", weeks);
  const data = await serverApi<CalendarData & { error?: string }>(`/api/spaces/${slug}/calendar${qs.size ? `?${qs}` : ""}`);
  if (!data || !("space" in data)) notFound();
  return <WorkshopCalendar key={`${data.from}-${data.days}`} initial={data} />;
}
