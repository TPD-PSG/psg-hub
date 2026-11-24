// A production's PM fee and its payment stages. PSG staff only (it's PSG's income), and only
// with access to that production's budget. PUT replaces the whole list of stages.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import { parseStages } from "@/lib/feeStages";

const staffOnly = (role: string) => (role === "admin" || role === "member" ? null : NextResponse.json({ error: "PSG staff only" }, { status: 403 }));

async function read(productionId: number) {
  const p = await prisma.production.findUnique({
    where: { id: productionId },
    select: {
      pmFee: true,
      feeStages: { orderBy: { sortOrder: "asc" } },
      fromOpportunity: { select: { id: true, title: true } },
    },
  });
  return p && { pmFee: p.pmFee, stages: p.feeStages, deal: p.fromOpportunity };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "budget");
  if ("error" in access) return access.error;
  const denied = staffOnly(access.role);
  if (denied) return denied;
  const fee = await read(Number(id));
  return fee ? NextResponse.json(fee) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "budget");
  if ("error" in access) return access.error;
  const denied = staffOnly(access.role);
  if (denied) return denied;
  const productionId = Number(id);
  const body = await req.json();
  const pmFee = body.pmFee === "" || body.pmFee == null ? null : Number(body.pmFee);
  if (pmFee != null && (!Number.isFinite(pmFee) || pmFee < 0)) return NextResponse.json({ error: "PM fee must be an amount" }, { status: 400 });
  const parsed = parseStages(body.stages ?? []);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!(await prisma.production.count({ where: { id: productionId } }))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const day = (v: string | null) => (v ? new Date(v) : null);
  await prisma.$transaction([
    prisma.production.update({ where: { id: productionId }, data: { pmFee } }),
    prisma.feeStage.deleteMany({ where: { productionId } }),
    prisma.feeStage.createMany({
      data: parsed.stages.map((s, i) => ({ productionId, label: s.label, amount: s.amount, dueDate: day(s.dueDate), invoicedAt: day(s.invoicedAt), paidAt: day(s.paidAt), sortOrder: i })),
    }),
  ]);
  return NextResponse.json(await read(productionId));
}
