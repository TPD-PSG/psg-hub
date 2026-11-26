// Public (QR code on site): crew without a Hub login report an accident or incident. It only ever
// creates a report and never shows one back. Rate-limited per device.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createIncident, readReport, readPhotos } from "@/lib/incidents";
import { incidentRef } from "@/lib/incidentsCore";

const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter(t => now - t < 10 * 60 * 1000);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > 10;
}

// A token is a show's or a workshop's (a company space's)
async function target(token: string): Promise<{ owner: { productionId: number | null; entityId: number | null }; name: string; venues: string[] } | null> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
  const p = await prisma.production.findUnique({
    where: { hsReportToken: token },
    select: { id: true, name: true, archived: true, venue: true, venueRef: { select: { name: true } }, isTour: true, tourStops: { select: { id: true, venue: { select: { name: true } } }, orderBy: { startDate: "asc" } } },
  });
  if (p) return p.archived ? null : { owner: { productionId: p.id, entityId: null }, name: p.name, venues: p.isTour ? [...new Set(p.tourStops.map(s => s.venue.name))] : [p.venueRef?.name ?? p.venue].filter((v): v is string => !!v) };
  const e = await prisma.entity.findUnique({ where: { hsReportToken: token }, select: { id: true, name: true, hasSpace: true, archived: true } });
  return e && e.hasSpace && !e.archived ? { owner: { productionId: null, entityId: e.id }, name: e.name, venues: [] } : null;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const t = await target((await params).token);
  if (!t) return NextResponse.json({ error: "This form is no longer active" }, { status: 404 });
  return NextResponse.json({ name: t.name, venues: t.venues });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";
  if (tooMany(ip)) return NextResponse.json({ error: "Too many reports from this device. Try again shortly, or tell the production manager." }, { status: 429 });
  const t = await target((await params).token);
  if (!t) return NextResponse.json({ error: "This form is no longer active" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const r = readReport(body);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const ph = readPhotos(body.photos);
  if ("error" in ph) return NextResponse.json({ error: ph.error }, { status: 400 });
  const inc = await createIncident(t.owner, r.data, { userId: null, viaQr: true }, ph.photos);
  return NextResponse.json({ ref: incidentRef(inc) }, { status: 201 });
}
