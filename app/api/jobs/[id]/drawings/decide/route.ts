// PSG recording the client's decision on drawing revisions (e.g. approved by email), one or many
// at once. Admins only for now; clients will decide for themselves once client logins are in.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jobAccess } from "@/lib/jobDesign";
import { decide, drawingsFor, gateBlockers, gateOverrides } from "@/lib/drawings";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  if (a.v.role !== "admin") return NextResponse.json({ error: "Only admins can record a sign-off for the client" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const decision = body.decision === "changes" ? "changes" : body.decision === "approved" ? "approved" : null;
  if (!decision) return NextResponse.json({ error: "Approve or ask for changes" }, { status: 400 });
  const ids = Array.isArray(body.revisionIds) ? body.revisionIds.map(Number).filter(Number.isInteger) : [];
  const me = await prisma.user.findUnique({ where: { id: a.v.userId }, select: { name: true } });
  const err = await decide(ids, decision, { id: a.v.userId, name: me?.name ?? "PSG" }, { comment: body.comment, onBehalf: true, jobId: a.id });
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  return NextResponse.json({ drawings: await drawingsFor(a.id), blockers: await gateBlockers(a.id), overrides: await gateOverrides(a.id) });
}
