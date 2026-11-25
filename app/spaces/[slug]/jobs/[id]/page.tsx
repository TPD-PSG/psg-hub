// A build's page inside its company's space (TWS mockup "Build job page"). Jobs from another
// company open on the normal Jobs page instead.
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { serverApi } from "@/lib/serverApi";
import type { JobDetail } from "@/app/jobs/[id]/JobView";
import type { PlannerData } from "../../planner/Planner";
import SpaceJob, { type PartRow, type JobMaterials, type JobPhoto } from "./SpaceJob";
import type { Check } from "@/components/BuildChecklist";
import type { JobContactRow, JobFileRow } from "@/components/BuildDesign";
import type { DrawingRow, Blocker, Override } from "@/components/DrawingRegister";
import type { VariationRow } from "@/components/Variations";

export default async function SpaceJobPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug) || !/^\d+$/.test(id)) notFound();
  const session = await auth();
  const me = session?.user as { id?: string; role?: string } | undefined;
  const [data, plan, parts, prods, materials, photos, checks, contacts, files, drawings, variations] = await Promise.all([
    serverApi<{ seeMoney: boolean; job: JobDetail }>(`/api/jobs/${id}`),
    serverApi<PlannerData>(`/api/spaces/${slug}/planner`),
    serverApi<PartRow[]>(`/api/jobs/${id}/parts`),
    serverApi<{ id: number; name: string; status?: string }[]>("/api/productions"),
    serverApi<JobMaterials>(`/api/jobs/${id}/materials`),
    serverApi<JobPhoto[]>(`/api/jobs/${id}/photos`),
    serverApi<Check[]>(`/api/jobs/${id}/checks`),
    serverApi<JobContactRow[]>(`/api/jobs/${id}/contacts`),
    serverApi<JobFileRow[]>(`/api/jobs/${id}/files`),
    serverApi<{ drawings: DrawingRow[]; blockers: Blocker[]; overrides: Override[] }>(`/api/jobs/${id}/drawings`),
    serverApi<VariationRow[]>(`/api/jobs/${id}/variations`), // only for people who can see prices
  ]);
  if (!data?.job || !plan?.space) notFound();
  if (data.job.entity?.id !== plan.space.id) redirect(`/jobs/${id}`);
  // People for "who": the space's crew first, then other PSG staff
  const people = [...plan.crew.map(c => ({ id: c.id, name: c.name })), ...plan.staff.filter(s => !plan.crew.some(c => c.id === s.id))];
  const productions = Array.isArray(prods) ? prods.filter(p => p.status !== "closed").map(p => ({ id: p.id, name: p.name })) : [];
  return (
    <SpaceJob key={data.job.id} space={plan.space} initial={data.job} seeMoney={data.seeMoney} initialParts={Array.isArray(parts) ? parts : []}
      people={people} productions={productions} initialMaterials={materials && "pos" in materials ? materials : { pos: [], moves: [], items: [] }}
      initialPhotos={Array.isArray(photos) ? photos : []} initialChecks={Array.isArray(checks) ? checks : []}
      initialContacts={Array.isArray(contacts) ? contacts : []} initialFiles={Array.isArray(files) ? files : []}
      initialDrawings={drawings && "drawings" in drawings ? drawings : { drawings: [], blockers: [] }} me={{ id: Number(me?.id), isAdmin: me?.role === "admin" }}
      initialVariations={Array.isArray(variations) ? variations : []} />
  );
}
