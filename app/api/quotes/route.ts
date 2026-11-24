// Quotes list and create (PSG staff). ?opportunityId= lists one deal's quotes. A new quote can
// start from a template (templateId) or from a deal (opportunityId: takes its client, entity, type).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLines, quoteTotals, type LineInput } from "@/lib/quotes";
import { QUOTE_INCLUDE, requireStaff, newNumber, quoteFields } from "@/lib/quoteData";

export async function GET(req: Request) {
  const who = await requireStaff();
  if ("error" in who) return who.error;
  const opp = Number(new URL(req.url).searchParams.get("opportunityId"));
  const quotes = await prisma.quote.findMany({
    where: Number.isInteger(opp) && opp > 0 ? { opportunityId: opp } : {},
    include: QUOTE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(quotes.map(q => ({ ...q, totals: quoteTotals(q.lines, q.vatRate) })));
}

export async function POST(req: Request) {
  const who = await requireStaff();
  if ("error" in who) return who.error;
  const body = await req.json();
  const fields = quoteFields(body);

  let lines: LineInput[] = [];
  let terms: string | null = null;
  if (body.templateId) {
    const t = await prisma.quoteTemplate.findUnique({ where: { id: Number(body.templateId) } });
    if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    const parsed = parseLines(JSON.parse(t.lines || "[]"));
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    lines = parsed.lines;
    terms = t.terms;
    fields.jobType ??= t.jobType;
    fields.entityId ??= t.entityId;
  } else if (body.lines) {
    const parsed = parseLines(body.lines);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    lines = parsed.lines;
  }
  if (fields.opportunityId) {
    const deal = await prisma.opportunity.findUnique({ where: { id: fields.opportunityId as number }, select: { title: true, clientId: true, entityId: true, type: true } });
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    fields.title ??= deal.title;
    if (!("clientId" in fields)) fields.clientId = deal.clientId;
    if (!("entityId" in fields) || fields.entityId == null) fields.entityId = deal.entityId;
    fields.jobType ??= deal.type === "scenic" ? "workshop" : "pm";
  }
  if (!fields.title) return NextResponse.json({ error: "Give the quote a title" }, { status: 400 });

  // Numbers are unique; if two people create a quote at once, try the next number
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const q = await prisma.quote.create({
        data: {
          ...fields, title: fields.title as string, number: await newNumber("Q"), terms: (fields.terms as string | null | undefined) ?? terms,
          createdById: who.userId,
          lines: { create: lines.map((l, i) => ({ ...l, sortOrder: i })) },
        },
        include: QUOTE_INCLUDE,
      });
      return NextResponse.json({ ...q, totals: quoteTotals(q.lines, q.vatRate) }, { status: 201 });
    } catch (err) {
      if (!(err instanceof Error && /Unique constraint/i.test(err.message)) || attempt === 2) throw err;
    }
  }
}
