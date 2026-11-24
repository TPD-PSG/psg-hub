// Quote templates (PSG staff): list, and save one from a quote ({ quoteId, name }).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/quoteData";

export async function GET() {
  const who = await requireStaff();
  if ("error" in who) return who.error;
  const t = await prisma.quoteTemplate.findMany({ include: { entity: { select: { name: true } } }, orderBy: [{ jobType: "asc" }, { name: "asc" }] });
  return NextResponse.json(t.map(x => ({ ...x, lineCount: (JSON.parse(x.lines || "[]") as unknown[]).length })));
}

export async function POST(req: Request) {
  const who = await requireStaff();
  if ("error" in who) return who.error;
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name the template" }, { status: 400 });
  const q = await prisma.quote.findUnique({ where: { id: Number(body.quoteId) }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  if (!q) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  const lines = q.lines.map(({ section, description, quantity, unit, unitCost, unitPrice }) => ({ section, description, quantity, unit, unitCost, unitPrice }));
  const t = await prisma.quoteTemplate.create({ data: { name: name.slice(0, 100), jobType: q.jobType, entityId: q.entityId, lines: JSON.stringify(lines), terms: q.terms } });
  return NextResponse.json(t, { status: 201 });
}
