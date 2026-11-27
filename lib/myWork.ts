// Freelancer logins (27 Nov 2026): "My work" in a company space. A freelancer sees only the build
// parts planned for them, and for the builds those parts are on: what to make, the drawings and
// design files, the snags and the build photos. They can tick a part done, raise and clear snags,
// and add photos. No prices or costs, and no other builds.
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { spaceMember, withUrl, type SpaceMember } from "./spaceBoard";

const DAY = 86_400_000;
/** Parts done more than this long ago drop off the list. */
export const DONE_DAYS = 14;

/** The signed-in person in this space, for My work routes. */
export async function myWorkViewer(slug: string): Promise<SpaceMember | { error: NextResponse }> {
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return spaceMember(slug);
}

/** Builds in this space that the person has a part on (any part, done or not); cancelled builds don't count. */
export async function myJobIds(userId: number, entityId: number) {
  const rows = await prisma.buildPart.findMany({ where: { userId, job: { entityId, status: { not: "cancelled" } } }, select: { jobId: true }, distinct: ["jobId"] });
  return rows.map(r => r.jobId);
}

/** A build the person may work on from My work, else an error response. */
export async function myJob(v: SpaceMember, rawJobId: string | number) {
  const jobId = Number(rawJobId);
  if (!Number.isInteger(jobId) || !(await myJobIds(v.userId, v.space.id)).includes(jobId)) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { jobId };
}

export async function myWork(v: SpaceMember) {
  const since = new Date(Date.now() - DONE_DAYS * DAY);
  const parts = await prisma.buildPart.findMany({
    where: { userId: v.userId, job: { entityId: v.space.id, status: { not: "cancelled" } }, OR: [{ done: false }, { updatedAt: { gte: since } }] },
    select: {
      id: true, jobId: true, label: true, startDate: true, days: true, hours: true, done: true, pencilled: true,
      labourType: { select: { name: true } },
      materials: { select: { id: true, description: true, quantity: true, unit: true }, orderBy: { id: "asc" } },
      machines: { select: { machine: { select: { id: true, name: true } } } },
    },
    orderBy: [{ done: "asc" }, { startDate: "asc" }, { id: "asc" }],
  });
  const jobIds = [...new Set(parts.map(p => p.jobId))];
  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds } },
    select: {
      id: true, number: true, title: true, stage: true, endDate: true, deliveryMethod: true, notes: true,
      forProduction: { select: { name: true } },
      drawings: { select: { id: true, number: true, title: true, revisions: { where: { status: { not: "superseded" } }, select: { id: true, rev: true, status: true, fileId: true, file: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: [{ number: "asc" }, { id: "asc" }] },
      files: { where: { kind: { in: ["design", "modelbox"] }, revision: null }, select: { id: true, kind: true, name: true, caption: true }, orderBy: { createdAt: "desc" } },
      checks: { where: { kind: "snag" }, select: { id: true, text: true, done: true, createdAt: true, createdBy: { select: { name: true } }, doneBy: { select: { name: true } } }, orderBy: [{ done: "asc" }, { sortOrder: "asc" }, { id: "asc" }] },
      photos: { select: { id: true, caption: true, createdAt: true, uploadedById: true, uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 12 },
    },
  });
  const byId = new Map(jobs.map(j => [j.id, {
    ...j,
    drawings: j.drawings.filter(d => d.revisions.length).map(d => ({ id: d.id, number: d.number, title: d.title, rev: d.revisions[0].rev, status: d.revisions[0].status, url: `/api/spaces/${v.space.slug}/my-work/files/${d.revisions[0].fileId}`, fileName: d.revisions[0].file.name })),
    files: j.files.map(f => ({ ...f, url: `/api/spaces/${v.space.slug}/my-work/files/${f.id}` })),
    photos: j.photos.map(withUrl),
  }]));
  return {
    parts: parts.map(p => ({ ...p, startDate: p.startDate?.toISOString() ?? null, machines: p.machines.map(m => m.machine) })),
    jobs: jobIds.map(id => byId.get(id)!).filter(Boolean),
  };
}
export type MyWorkData = Awaited<ReturnType<typeof myWork>> & { space: SpaceMember["space"]; me: { id: number; name: string | null } };
