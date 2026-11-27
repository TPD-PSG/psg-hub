// One quote (PSG staff). PUT changes the header fields sent and, if "lines" is sent, replaces
// the lines. Status changes stamp when it was sent or decided. Only drafts can be deleted
// (admins can delete any).
import { myCompanyLimit, entityChangeError } from "@/lib/companyScope";
import { denyOutOfScope } from "@/lib/companyScope";
import { syncQuoteParts, dropQuoteParts } from "@/lib/quoteParts";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseQuoteLines, quoteTotals } from "@/lib/quotes";
import { QUOTE_INCLUDE, requireStaff, quoteFields } from "@/lib/quoteData";
import { confirmPencils } from "@/lib/buildParts";

async function load(id: number) {
  const q = await prisma.quote.findUnique({ where: { id }, include: QUOTE_INCLUDE });
  return q && { ...q, totals: quoteTotals(q.lines, q.vatRate) };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("quote", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const who = await requireStaff();
  if ("error" in who) return who.error;
  const q = await load(parseInt((await params).id));
  return q ? NextResponse.json(q) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("quote", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const who = await requireStaff();
  if ("error" in who) return who.error;
  const id = parseInt((await params).id);
  const existing = await prisma.quote.findUnique({ where: { id }, select: { status: true, vatRate: true, lines: { orderBy: { sortOrder: "asc" }, select: { section: true, description: true, quantity: true, unit: true, unitCost: true, unitPrice: true, kind: true, hideLine: true, hidePrice: true, leaveOut: true } } } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const fields = quoteFields(body);
  const moveErr = entityChangeError(await myCompanyLimit(), fields);
  if (moveErr) return NextResponse.json({ error: moveErr }, { status: 400 });
  if (fields.status && fields.status !== existing.status) {
    if (fields.status === "sent") fields.sentAt = new Date();
    if (fields.status === "accepted" || fields.status === "declined") fields.decidedAt = new Date();
    if (fields.status === "draft") fields.decidedAt = null;
  }
  let lineOps = {};
  // An accepted quote's price is locked while it stays accepted: changes go through a variation,
  // or the quote is set back first (audit round 2)
  const staysAccepted = existing.status === "accepted" && (!fields.status || fields.status === "accepted");
  type L = { section: string | null; description: string; quantity: number; unit: string | null; unitCost: number; unitPrice: number; kind?: string | null; hideLine?: boolean; hidePrice?: boolean; leaveOut?: boolean };
  const key = (ls: L[]) => JSON.stringify(ls.map(l => [l.section ?? null, l.description, l.quantity, l.unit ?? null, l.unitCost, l.unitPrice, l.kind ?? null, !!l.hideLine, !!l.hidePrice, !!l.leaveOut]));
  const sameLines = (a: L[], b: L[]) => key(a) === key(b);
  if ("lines" in body) {
    const parsed = parseQuoteLines(body.lines);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (staysAccepted && !sameLines(parsed.lines, existing.lines)) return NextResponse.json({ error: "This quote has been accepted, so its lines are locked. Add a variation to the job for changes." }, { status: 409 });
    if (!staysAccepted) lineOps = { lines: { deleteMany: {}, create: parsed.lines.map((l, i) => ({ ...l, sortOrder: i })) } };
  }
  if (staysAccepted && fields.vatRate !== undefined && fields.vatRate !== existing.vatRate) return NextResponse.json({ error: "This quote has been accepted, so its VAT rate is locked." }, { status: 409 });
  // An accepted quote on a deal that already has a job becomes that job's quote
  if (fields.status === "accepted") {
    const q = await prisma.quote.findUnique({ where: { id }, select: { jobId: true, opportunity: { select: { job: { select: { id: true } } } } } });
    if (!q?.jobId && q?.opportunity?.job) fields.jobId = q.opportunity.job.id;
  }
  await prisma.quote.update({ where: { id }, data: { ...fields, ...lineOps } });
  // One accepted quote per job: accepting this one sets any other accepted quote on the job aside
  if (fields.status === "accepted" && existing.status !== "accepted") {
    const jq = await prisma.quote.findUnique({ where: { id }, select: { jobId: true } });
    if (jq?.jobId) {
      const others = await prisma.quote.findMany({ where: { jobId: jq.jobId, status: "accepted", id: { not: id } }, select: { id: true } });
      await prisma.quote.updateMany({ where: { id: { in: others.map(o => o.id) } }, data: { status: "declined", decidedAt: new Date() } });
      for (const o of others) await syncQuoteParts(o.id); // a set-aside quote's untouched parts go
    }
  }
  // A build still at the Quote stage moves on to Confirmation once its quote is accepted
  if (fields.status === "accepted") {
    const jq = await prisma.quote.findUnique({ where: { id }, select: { jobId: true } });
    if (jq?.jobId) {
      const moved = await prisma.job.updateMany({ where: { id: jq.jobId, stage: "quote" }, data: { stage: "confirmation", stageChangedAt: new Date() } });
      if (moved.count) await confirmPencils(jq.jobId); // pencilled dates become bookings
      await prisma.buildPart.updateMany({ where: { quoteId: id, pencilled: true }, data: { pencilled: false } }); // its own parts are firm now
    }
  }
  // Its items are the build's parts: keep them in step (renamed items carry their part with them)
  const renames = body.renamedItems && typeof body.renamedItems === "object" ? Object.fromEntries(Object.entries(body.renamedItems as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string> : {};
  await syncQuoteParts(id, renames);
  return NextResponse.json(await load(id));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("quote", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const who = await requireStaff();
  if ("error" in who) return who.error;
  const id = parseInt((await params).id);
  const q = await prisma.quote.findUnique({ where: { id }, select: { status: true } });
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (q.status !== "draft" && who.role !== "admin") return NextResponse.json({ error: "Only drafts can be deleted; mark it declined instead" }, { status: 409 });
  await dropQuoteParts(id); // its parts nobody has started on go with it
  await prisma.quote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
