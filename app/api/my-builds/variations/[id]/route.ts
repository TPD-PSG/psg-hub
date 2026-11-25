// A client approves or declines a variation sent to them (declining needs a reason).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientViewer, clientBuilds, clientBrand } from "@/lib/clientPortal";
import { decideVariation, variationPdfData } from "@/lib/variations";

// A sent or decided variation on one of the client's builds, as PDF data (prices only)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await clientViewer();
  if ("error" in v) return v.error;
  const id = parseInt((await params).id) || 0;
  const mine = await prisma.jobVariation.count({ where: { id, status: { not: "draft" }, job: { clientId: v.clientId, status: { not: "cancelled" } } } });
  if (!mine) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await variationPdfData(id));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await clientViewer();
  if ("error" in v) return v.error;
  const id = parseInt((await params).id) || 0;
  const mine = await prisma.jobVariation.findFirst({ where: { id, status: { not: "draft" }, job: { clientId: v.clientId, status: { not: "cancelled" } } }, select: { id: true } });
  if (!mine) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.decision !== "approved" && body.decision !== "declined") return NextResponse.json({ error: "Approve or decline" }, { status: 400 });
  const err = await decideVariation(id, body.decision, { name: v.name, onBehalf: false }, typeof body.comment === "string" ? body.comment : null);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  return NextResponse.json({ me: { name: v.name, company: v.clientName }, builds: await clientBuilds(v.clientId), brand: await clientBrand(v.clientId) });
}
