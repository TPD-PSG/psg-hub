// Materials & kit for a company space: stock, reorder levels and purchase orders
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import Materials, { type MaterialsData } from "./Materials";

export default async function MaterialsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ new?: string; job?: string; order?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  const data = await serverApi<MaterialsData & { error?: string }>(`/api/spaces/${slug}/materials`);
  if (!data || !("space" in data)) notFound();
  const num = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : null);
  return <Materials initial={data} start={{ open: sp.new === "1" || !!num(sp.order), jobId: num(sp.job), itemId: num(sp.order) }} />;
}
