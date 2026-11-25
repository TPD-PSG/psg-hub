// A client approves drawings (one or several) or asks for changes with a comment.
// Only the latest revisions of their own company's builds; PSG is told.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decide } from "@/lib/drawings";
import { clientViewer, clientBuilds, clientBrand, notifyPsgOfDecision } from "@/lib/clientPortal";

export async function POST(req: Request) {
  const v = await clientViewer();
  if ("error" in v) return v.error;
  const body = await req.json().catch(() => ({}));
  const ids: number[] = Array.isArray(body.revisionIds) ? body.revisionIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0) : [];
  const decision = body.decision === "approved" || body.decision === "changes" ? body.decision : null;
  if (!decision) return NextResponse.json({ error: "Approve or ask for changes" }, { status: 400 });
  if (!ids.length) return NextResponse.json({ error: "Pick at least one drawing" }, { status: 400 });
  const mine = await prisma.drawingRevision.count({ where: { id: { in: ids }, drawing: { job: { clientId: v.clientId, status: { not: "cancelled" } } } } });
  if (mine !== new Set(ids).size) return NextResponse.json({ error: "Those drawings aren't on your builds" }, { status: 403 });
  const comment = typeof body.comment === "string" ? body.comment : null;
  const err = await decide([...new Set(ids)], decision, { id: v.userId, name: v.name }, { comment, onBehalf: false });
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  await notifyPsgOfDecision(ids, decision, v.name, comment?.trim() || null).catch(() => {});
  return NextResponse.json({ me: { name: v.name, company: v.clientName }, builds: await clientBuilds(v.clientId), brand: await clientBrand(v.clientId) });
}
