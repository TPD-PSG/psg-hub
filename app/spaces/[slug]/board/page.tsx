// A company space's build board: its live workshop builds in a column per stage.
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import type { SpaceData } from "../SpaceHome";
import BuildBoard from "./BuildBoard";
import { staffPageOrMyWork } from "@/lib/spaceStaffPage";

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  await staffPageOrMyWork(slug); // freelancers work from My work
  const data = await serverApi<SpaceData & { error?: string }>(`/api/spaces/${slug}`);
  if (!data || !("space" in data)) notFound();
  return <BuildBoard initial={data} slug={slug} />;
}
