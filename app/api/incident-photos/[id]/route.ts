// One photo on an incident report: seen by whoever can see the report; removed by the show's staff or a lead.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadFile, removeFile } from "@/lib/storage";
import { INCIDENT_INCLUDE } from "@/lib/incidents";
import { incidentFor } from "@/lib/incidentRoute";

async function photo(id: string) {
  const n = Number(id);
  return Number.isInteger(n) ? prisma.incidentPhoto.findUnique({ where: { id: n } }) : null;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await photo((await params).id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await incidentFor(p.incidentId, "view");
  if ("error" in r) return r.error;
  const buf = await loadFile(p.fileKey, p.data);
  if (!buf) return NextResponse.json({ error: "File missing" }, { status: 404 });
  return new NextResponse(buf, { headers: { "Content-Type": p.mime, "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="${p.name.replace(/"/g, "")}"` } });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await photo((await params).id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await incidentFor(p.incidentId, "manage");
  if ("error" in r) return r.error;
  if (r.inc.status === "closed") return NextResponse.json({ error: "This report is closed. Reopen it to change it." }, { status: 409 });
  await prisma.incidentPhoto.delete({ where: { id: p.id } });
  await removeFile(p.fileKey);
  return NextResponse.json(await prisma.incident.findUnique({ where: { id: p.incidentId }, include: INCIDENT_INCLUDE }));
}
