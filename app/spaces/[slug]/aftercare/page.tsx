// A space's repairs and aftercare for sets on tour
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import Aftercare, { type AftercareData } from "./Aftercare";

export default async function AftercarePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  const data = await serverApi<AftercareData>(`/api/spaces/${slug}/repairs`);
  if (!data?.space) notFound();
  return <Aftercare initial={data} />;
}
