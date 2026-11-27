// Rental kit: every product and its serialised units (PSG Rentals & Crew)
import { rentalsData } from "../rentalsPage";
import Kit from "./Kit";

export default async function KitPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ product?: string; q?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await rentalsData(slug);
  return <Kit initial={data} openId={sp.product && /^\d+$/.test(sp.product) ? Number(sp.product) : null} q={sp.q ?? ""} />;
}
