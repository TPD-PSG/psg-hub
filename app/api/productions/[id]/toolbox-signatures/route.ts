import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  const sigs = await prisma.toolboxTalkSignature.findMany({
    where: { productionId: Number(id) },
    orderBy: { createdAt: "desc" },
    select: { id: true, tourStopId: true, venueName: true, signeeName: true, signeeDate: true, employer: true, position: true, agreedBriefing: true, agreedSafety: true, createdAt: true },
  });
  return NextResponse.json(sigs);
}

// Public (QR code on site), so validate everything and rate-limit per IP
const recent = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter(t => now - t < 10 * 60 * 1000);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > 30;
}
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";
  if (tooMany(ip)) return NextResponse.json({ error: "Too many sign-offs from this device. Try again shortly." }, { status: 429 });

  const productionId = Number(id);
  const production = Number.isInteger(productionId)
    ? await prisma.production.findUnique({ where: { id: productionId }, select: { archived: true } })
    : null;
  if (!production || production.archived) return NextResponse.json({ error: "This sign-off form is no longer active" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const signeeName = text(body.signeeName, 120);
  const signeeDate = text(body.signeeDate, 40);
  const signature = typeof body.signature === "string" ? body.signature : "";
  if (!signeeName || !signeeDate) return NextResponse.json({ error: "Name and date are required" }, { status: 400 });
  if (!signature.startsWith("data:image/") || signature.length > 500_000) {
    return NextResponse.json({ error: "Please sign in the signature box" }, { status: 400 });
  }
  let tourStopId: number | null = null;
  if (body.tourStopId) {
    const stop = await prisma.tourStop.findFirst({ where: { id: Number(body.tourStopId), productionId }, select: { id: true } });
    if (!stop) return NextResponse.json({ error: "Unknown venue for this production" }, { status: 400 });
    tourStopId = stop.id;
  }

  const sig = await prisma.toolboxTalkSignature.create({
    data: {
      productionId,
      tourStopId,
      venueName: text(body.venueName, 200) || null,
      signeeName,
      signeeDate,
      employer: text(body.employer, 200) || null,
      position: text(body.position, 200) || null,
      signature,
      agreedBriefing: !!body.agreedBriefing,
      agreedSafety: !!body.agreedSafety,
    },
  });
  return NextResponse.json(sig, { status: 201 });
}
