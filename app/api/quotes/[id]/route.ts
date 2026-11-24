// One quote (PSG staff). PUT changes the header fields sent and, if "lines" is sent, replaces
// the lines. Status changes stamp when it was sent or decided. Only drafts can be deleted
// (admins can delete any).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLines, quoteTotals } from "@/lib/quotes";
import { QUOTE_INCLUDE, requireStaff, quoteFields } from "@/lib/quoteData";

async function load(id: number) {
  const q = await prisma.quote.findUnique({ where: { id }, include: QUOTE_INCLUDE });
  return q && { ...q, totals: quoteTotals(q.lines, q.vatRate) };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireStaff();
  if ("error" in who) return who.error;
  const q = await load(parseInt((await params).id));
  return q ? NextResponse.json(q) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireStaff();
  if ("error" in who) return who.error;
  const id = parseInt((await params).id);
  const existing = await prisma.quote.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const fields = quoteFields(body);
  if (fields.status && fields.status !== existing.status) {
    if (fields.status === "sent") fields.sentAt = new Date();
    if (fields.status === "accepted" || fields.status === "declined") fields.decidedAt = new Date();
    if (fields.status === "draft") fields.decidedAt = null;
  }
  let lineOps = {};
  if ("lines" in body) {
    const parsed = parseLines(body.lines);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    lineOps = { lines: { deleteMany: {}, create: parsed.lines.map((l, i) => ({ ...l, sortOrder: i })) } };
  }
  await prisma.quote.update({ where: { id }, data: { ...fields, ...lineOps } });
  return NextResponse.json(await load(id));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireStaff();
  if ("error" in who) return who.error;
  const id = parseInt((await params).id);
  const q = await prisma.quote.findUnique({ where: { id }, select: { status: true } });
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (q.status !== "draft" && who.role !== "admin") return NextResponse.json({ error: "Only drafts can be deleted; mark it declined instead" }, { status: 409 });
  await prisma.quote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
