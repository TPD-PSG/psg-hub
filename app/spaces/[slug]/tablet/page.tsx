// Tablet mode: the shared workshop tablet (clock on/off, build photos, snags)
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import Tablet, { type TabletData } from "./Tablet";

export default async function TabletPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  const data = await serverApi<TabletData>(`/api/spaces/${slug}/tablet`);
  if (!data?.space) notFound();
  return <Tablet initial={data} />;
}
