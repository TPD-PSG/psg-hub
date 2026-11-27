// Crew in the Rentals space: the crew diary, who's free on a day, and the crew directory
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import { staffPageOrMyWork } from "@/lib/spaceStaffPage";
import CrewPage, { type CrewData } from "./CrewPage";

export default async function Crew({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  await staffPageOrMyWork(slug);
  const data = await serverApi<CrewData & { error?: string }>(`/api/spaces/${slug}/rentals/crew`);
  if (!data || !("space" in data)) notFound();
  return <CrewPage initial={data} />;
}
