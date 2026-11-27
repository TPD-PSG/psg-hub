// A crew member's private offer link (no login): the job, and whether they're free.
import { serverApi } from "@/lib/serverApi";
import CrewOfferView, { type OfferView } from "./CrewOfferView";

export const metadata = { title: "Crew offer · PSG" };

export default async function CrewOfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? await serverApi<OfferView & { error?: string }>(`/api/crew-offer/${token}`) : null;
  return <CrewOfferView token={token} initial={view && "job" in view ? view : null} />;
}
