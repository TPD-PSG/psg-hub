// A company space's noticeboard: notices, build photos, showcases and build of the month
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import Noticeboard, { type BoardData } from "./Noticeboard";

export default async function NoticeboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  const data = await serverApi<BoardData & { error?: string }>(`/api/spaces/${slug}/noticeboard`);
  if (!data || !("space" in data)) notFound();
  return <Noticeboard initial={data} />;
}
