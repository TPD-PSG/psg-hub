// Hires: quotes, confirmed hires, what's out and what's back (PSG Rentals & Crew)
import { rentalsData } from "../rentalsPage";
import Hires from "./Hires";

export default async function HiresPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ hire?: string; new?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  return <Hires initial={await rentalsData(slug)} openId={sp.hire && /^\d+$/.test(sp.hire) ? Number(sp.hire) : null} startNew={sp.new === "1"} />;
}
