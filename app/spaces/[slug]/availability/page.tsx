// What's free on which dates, product by product (PSG Rentals & Crew)
import { rentalsData } from "../rentalsPage";
import Availability from "./Availability";

export default async function AvailabilityPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  return <Availability initial={await rentalsData(slug)} from={sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : null} />;
}
