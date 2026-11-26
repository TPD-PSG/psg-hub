// Add photos to a report after it's filed: its reporter, the show's staff or an H&S lead.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INCIDENT_INCLUDE, MAX_PHOTOS, readPhotos, savePhotos } from "@/lib/incidents";
import { incidentFor } from "@/lib/incidentRoute";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await incidentFor((await params).id, "view");
  if ("error" in r) return r.error;
  if (r.inc.status === "closed") return NextResponse.json({ error: "This report is closed. Reopen it to add photos." }, { status: 409 });
  const have = await prisma.incidentPhoto.count({ where: { incidentId: r.inc.id } });
  const ph = readPhotos((await req.json().catch(() => ({}))).photos, MAX_PHOTOS - have);
  if ("error" in ph) return NextResponse.json({ error: ph.error }, { status: 400 });
  await savePhotos(r.inc.id, ph.photos);
  return NextResponse.json(await prisma.incident.findUnique({ where: { id: r.inc.id }, include: INCIDENT_INCLUDE }), { status: 201 });
}
