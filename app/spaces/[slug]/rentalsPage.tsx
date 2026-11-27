// Server loader shared by the rentals space's pages: staff only, and only in a rentals space.
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import { staffPageOrMyWork } from "@/lib/spaceStaffPage";
import type { RentalsData } from "@/components/rentals/format";

export async function rentalsData(slug: string) {
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  await staffPageOrMyWork(slug);
  const data = await serverApi<RentalsData & { error?: string }>(`/api/spaces/${slug}/rentals`);
  if (!data || !("space" in data)) notFound();
  return data;
}
