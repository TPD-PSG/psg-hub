// Drawings for client sign-off (26 Nov 2026): each drawing has revisions A, B, C…; only the
// latest counts (older ones are superseded). Decisions are logged (who, when, which revision).
// A build can't move to Build, Finish or Delivery while any drawing's latest revision isn't
// approved; an admin can override with a reason (logged on the build).
import { prisma } from "@/lib/prisma";

export const GATED_STAGES = ["build", "finish", "delivery"];

/** A → B … Z → AA → AB … */
export function nextRev(existing: string[]): string {
  if (!existing.length) return "A";
  const toN = (s: string) => s.split("").reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0);
  const toS = (n: number) => { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
  return toS(Math.max(...existing.map(toN)) + 1);
}

export const DRAWING_INCLUDE = {
  revisions: {
    orderBy: { createdAt: "desc" as const },
    include: {
      file: { select: { id: true, name: true, mime: true, size: true, createdAt: true, uploadedBy: { select: { name: true } } } },
      decisions: { orderBy: { createdAt: "desc" as const }, select: { id: true, decision: true, comment: true, byName: true, onBehalf: true, createdAt: true } },
    },
  },
};

export async function drawingsFor(jobId: number) {
  const ds = await prisma.drawing.findMany({ where: { jobId }, include: DRAWING_INCLUDE, orderBy: [{ number: "asc" }, { createdAt: "asc" }] });
  return ds.map(d => ({ ...d, latest: d.revisions[0] ?? null, revisions: d.revisions.map(r => ({ ...r, file: { ...r.file, url: `/api/job-files/${r.file.id}` } })) }));
}

/** Admin overrides of the sign-off gate on a build, newest first. */
export const gateOverrides = (jobId: number) => prisma.jobLog.findMany({ where: { jobId, kind: "gate_override" }, select: { id: true, text: true, createdAt: true }, orderBy: { createdAt: "desc" } });

/** Drawings whose latest revision isn't approved (what stops the build). */
export async function gateBlockers(jobId: number) {
  const ds = await drawingsFor(jobId);
  return ds.filter(d => d.latest && d.latest.status !== "approved").map(d => ({ id: d.id, label: `${d.number ? `${d.number} ` : ""}${d.title}`, rev: d.latest!.rev, status: d.latest!.status }));
}

/**
 * Approve or ask for changes on latest revisions. Returns an error message, or null when done.
 * `onBehalf`: PSG recording the client's decision (e.g. given by email).
 */
export async function decide(revisionIds: number[], decision: "approved" | "changes", who: { id: number; name: string }, opts: { comment?: string | null; onBehalf?: boolean; jobId?: number }) {
  if (!revisionIds.length) return "Pick at least one drawing";
  const revs = await prisma.drawingRevision.findMany({ where: { id: { in: revisionIds } }, select: { id: true, status: true, drawing: { select: { jobId: true, number: true, title: true } } } });
  if (revs.length !== revisionIds.length) return "Some of those drawings weren't found";
  if (opts.jobId != null && revs.some(r => r.drawing.jobId !== opts.jobId)) return "Those drawings aren't all on this build";
  const stale = revs.find(r => r.status === "superseded");
  if (stale) return `${stale.drawing.number ?? stale.drawing.title} has a newer revision; decide on that one`;
  if (decision === "changes" && !opts.comment?.trim()) return "Say what needs changing";
  const comment = opts.comment?.trim() ? opts.comment.trim().slice(0, 2000) : null;
  await prisma.$transaction(revs.flatMap(r => [
    prisma.drawingDecision.create({ data: { revisionId: r.id, decision, comment, userId: who.id, byName: who.name, onBehalf: !!opts.onBehalf } }),
    prisma.drawingRevision.update({ where: { id: r.id }, data: { status: decision } }),
  ]));
  return null;
}
