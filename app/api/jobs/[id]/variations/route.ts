// A build's variations: list and start one (staff who can see prices).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLines } from "@/lib/quotes";
import { variationStaff, variationsFor, defaultVat, forStaff, VARIATION_INCLUDE } from "@/lib/variations";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await variationStaff((await params).id);
  if ("error" in a) return a.error;
  return NextResponse.json(await variationsFor(a.id));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await variationStaff((await params).id);
  if ("error" in a) return a.error;
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "Say what the variation is" }, { status: 400 });
  const parsed = parseLines(Array.isArray(body.lines) ? body.lines.filter((l: { description?: string }) => l?.description?.trim()) : []);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const last = await prisma.jobVariation.findFirst({ where: { jobId: a.id }, orderBy: { number: "desc" }, select: { number: true } });
  const v = await prisma.jobVariation.create({
    data: {
      jobId: a.id, number: (last?.number ?? 0) + 1, title, notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 4000) : null,
      vatRate: await defaultVat(a.id), createdById: a.v.userId,
      lines: { create: parsed.lines.map((l, i) => ({ ...l, sortOrder: i })) },
    },
    include: VARIATION_INCLUDE,
  });
  return NextResponse.json(forStaff(v), { status: 201 });
}
