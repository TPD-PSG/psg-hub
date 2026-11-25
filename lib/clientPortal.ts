// Client logins (plans sign-off part 2, 26 Nov 2026): a client account belongs to a client company
// (User.clientId). It sees that company's builds, their progress and drawings, and approves the
// latest revisions one at a time or several at once, or asks for changes with a comment.
// PSG hears about every decision; the client hears about every new drawing or revision.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { spaceLogoUrl } from "@/lib/entities";
import type { SpaceTheme } from "@/lib/spaces";

export type ClientViewer = { userId: number; name: string; clientId: number; clientName: string };

/** The signed-in client and their company, or why not. */
export async function clientViewer(): Promise<ClientViewer | { error: NextResponse }> {
  const session = await auth();
  const id = Number((session?.user as { id?: string } | undefined)?.id);
  if (!id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true, role: true, client: { select: { id: true, name: true } } } });
  if (u?.role !== "client") return { error: NextResponse.json({ error: "This page is for client logins" }, { status: 403 }) };
  if (!u.client) return { error: NextResponse.json({ error: "Your login isn't linked to a company yet. Ask PSG to link it." }, { status: 403 }) };
  return { userId: id, name: u.name, clientId: u.client.id, clientName: u.client.name };
}

/** The client's builds (not cancelled), newest first, with drawings (latest revision first) for sign-off. */
export async function clientBuilds(clientId: number) {
  const jobs = await prisma.job.findMany({
    where: { clientId, status: { not: "cancelled" }, OR: [{ jobType: "workshop" }, { stage: { not: null } }, { drawings: { some: {} } }] },
    select: {
      id: true, number: true, title: true, stage: true, status: true, startDate: true, endDate: true,
      entity: { select: { name: true, shortName: true, slug: true, color: true, logoMime: true, updatedAt: true } },
      drawings: {
        orderBy: [{ number: "asc" }, { createdAt: "asc" }],
        select: {
          id: true, number: true, title: true,
          revisions: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true, rev: true, status: true, note: true, createdAt: true,
              file: { select: { name: true, mime: true } },
              decisions: { orderBy: { createdAt: "desc" }, select: { id: true, decision: true, comment: true, byName: true, onBehalf: true, createdAt: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return jobs.map(j => ({
    ...j,
    builder: j.entity ? { name: j.entity.name, shortName: j.entity.shortName, color: j.entity.color, logoUrl: spaceLogoUrl(j.entity) } : null,
    entity: undefined,
    drawings: j.drawings.map(d => ({
      ...d,
      revisions: d.revisions.map(r => ({ ...r, url: `/api/my-builds/files/${r.id}` })),
    })),
  }));
}

/**
 * Whose brand the client sees: the company space building most of their builds (e.g. TWS).
 * null = none of their builders has a space, so the page wears PSG's.
 */
export async function clientBrand(clientId: number): Promise<SpaceTheme | null> {
  const rows = await prisma.job.groupBy({ by: ["entityId"], where: { clientId, status: { not: "cancelled" }, entityId: { not: null } }, _count: { _all: true } });
  for (const r of rows.sort((a, b) => b._count._all - a._count._all)) {
    const e = await prisma.entity.findUnique({ where: { id: r.entityId! }, select: { id: true, name: true, shortName: true, slug: true, color: true, logoMime: true, updatedAt: true, hasSpace: true, archived: true } });
    if (e?.hasSpace && !e.archived && e.slug) return { id: e.id, name: e.name, shortName: e.shortName, slug: e.slug, color: e.color, logoUrl: spaceLogoUrl(e) };
  }
  return null;
}

/** Tell people something, skipping duplicates and nobody. */
export async function notify(userIds: (number | null | undefined)[], n: { title: string; body?: string | null; link?: string | null }) {
  const ids = [...new Set(userIds.filter((x): x is number => !!x))];
  if (ids.length) await prisma.notification.createMany({ data: ids.map(userId => ({ userId, title: n.title.slice(0, 200), body: n.body?.slice(0, 1000) ?? null, link: n.link ?? null })) });
}

/** A client decided: tell whoever uploaded those revisions and the admins. */
export async function notifyPsgOfDecision(revisionIds: number[], decision: "approved" | "changes", who: string, comment: string | null) {
  const revs = await prisma.drawingRevision.findMany({
    where: { id: { in: revisionIds } },
    select: { rev: true, file: { select: { uploadedById: true } }, drawing: { select: { number: true, title: true, job: { select: { id: true, title: true, entity: { select: { slug: true, hasSpace: true } } } } } } },
  });
  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  const byJob = new Map<number, typeof revs>();
  for (const r of revs) byJob.set(r.drawing.job.id, [...(byJob.get(r.drawing.job.id) ?? []), r]);
  for (const [jobId, list] of byJob) {
    const job = list[0].drawing.job;
    const names = list.map(r => `${r.drawing.number ?? r.drawing.title} rev ${r.rev}`).join(", ");
    const link = job.entity?.hasSpace && job.entity.slug ? `/spaces/${job.entity.slug}/jobs/${jobId}` : `/jobs/${jobId}`;
    await notify([...list.map(r => r.file.uploadedById), ...admins.map(a => a.id)], {
      title: decision === "approved" ? `${who} approved ${list.length === 1 ? "a drawing" : `${list.length} drawings`} on ${job.title}` : `${who} asked for changes on ${job.title}`,
      body: decision === "approved" ? names : `${names}: ${comment ?? ""}`,
      link,
    });
  }
}

/** A drawing or revision went up: tell the client's logins. */
export async function notifyClientOfDrawing(jobId: number, what: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { title: true, clientId: true } });
  if (!job?.clientId) return;
  const users = await prisma.user.findMany({ where: { clientId: job.clientId, role: "client" }, select: { id: true } });
  await notify(users.map(u => u.id), { title: `New drawing to sign off on ${job.title}`, body: what, link: "/my-builds" });
}
