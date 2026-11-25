// A company's space (e.g. The Workshop Stoke): loaded on the server like the rest of the Hub.
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import SpaceHome, { type SpaceData } from "./SpaceHome";

export default async function SpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  const data = await serverApi<SpaceData & { error?: string }>(`/api/spaces/${slug}`);
  if (!data || !("space" in data)) notFound();
  return <SpaceHome data={data} />;
}
