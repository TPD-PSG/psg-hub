"use client";
import type { SpaceTheme } from "@/lib/spaces";
import type { RateCard } from "@/lib/rateCardPdf";
import RateCardView from "@/components/rentals/RateCardView";
import { RentalsHeader } from "@/components/rentals/shared";

export default function RatesPage({ space, card }: { space: SpaceTheme; card: RateCard | null }) {
  return (
    <>
      <RentalsHeader space={space} title="Rate card" line="Kit with a day or week rate, as client logins see it. Download the PDF to send to anyone." />
      <div className="px-4 sm:px-10 pt-6 pb-10">{card ? <RateCardView data={card} /> : <p className="text-sm">The rate card couldn&apos;t be loaded.</p>}</div>
    </>
  );
}
