// The hire rate card in the Rentals space: what clients see, with a PDF to send out
import { rentalsData } from "../rentalsPage";
import { serverApi } from "@/lib/serverApi";
import RatesPage from "./RatesPage";
import type { RateCard } from "@/lib/rateCardPdf";

export default async function Rates({ params }: { params: Promise<{ slug: string }> }) {
  const data = await rentalsData((await params).slug);
  const card = await serverApi<RateCard & { error?: string }>(`/api/rate-card?companyId=${data.space.id}`);
  return <RatesPage space={data.space} card={card && "products" in card ? card : null} />;
}
