// The workshop planner for a company space (TWS mockup "Workshop planner")
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import Planner, { type PlannerData } from "./Planner";

export default async function PlannerPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> }) {
  const { slug } = await params;
  const { from } = await searchParams;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  const q = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? `?from=${from}` : "";
  const data = await serverApi<PlannerData & { error?: string }>(`/api/spaces/${slug}/planner${q}`);
  if (!data || !("space" in data)) notFound();
  return <Planner key={data.from} initial={data} />;
}
