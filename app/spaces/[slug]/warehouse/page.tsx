// The warehouse: prep hires by scanning kit out, check it back in, damage and missing kit
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import { staffPageOrMyWork } from "@/lib/spaceStaffPage";
import Warehouse, { type WarehouseList } from "./Warehouse";

export default async function WarehousePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ hire?: string; mode?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  await staffPageOrMyWork(slug);
  const data = await serverApi<WarehouseList & { error?: string }>(`/api/spaces/${slug}/rentals/warehouse`);
  if (!data || !("space" in data)) notFound();
  return <Warehouse initial={data} hireId={sp.hire && /^\d+$/.test(sp.hire) ? Number(sp.hire) : null} mode={sp.mode === "in" ? "in" : "out"} />;
}
