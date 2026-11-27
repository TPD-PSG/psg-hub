// A company space's builds, live and past (TWS mockup "Build jobs")
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import type { SpaceTheme } from "@/lib/spaces";
import BuildJobs, { type BuildRow } from "./BuildJobs";
import { staffPageOrMyWork } from "@/lib/spaceStaffPage";

export default async function BuildJobsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  await staffPageOrMyWork(slug); // freelancers work from My work
  const [space, data] = await Promise.all([
    serverApi<{ space?: SpaceTheme; canEdit?: boolean }>(`/api/spaces/${slug}`),
    serverApi<{ seeMoney: boolean; jobs: BuildRow[] }>("/api/jobs"),
  ]);
  if (!space?.space) notFound();
  const jobs = Array.isArray(data?.jobs) ? data.jobs.filter(j => j.entity?.id === space.space!.id) : null;
  return <BuildJobs space={space.space} jobs={jobs} seeMoney={!!data?.seeMoney} canEdit={!!space.canEdit} />;
}
