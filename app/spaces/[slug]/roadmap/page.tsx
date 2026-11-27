// A company space's view of the shared roadmap
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import SpaceRoadmap, { type RoadmapData } from "./SpaceRoadmap";
import { staffPageOrMyWork } from "@/lib/spaceStaffPage";

export default async function RoadmapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  await staffPageOrMyWork(slug); // freelancers work from My work
  const data = await serverApi<RoadmapData & { error?: string }>(`/api/spaces/${slug}/roadmap`);
  if (!data || !("space" in data)) notFound();
  return <SpaceRoadmap initial={data} />;
}
