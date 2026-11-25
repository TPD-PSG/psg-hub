// Materials & kit for a space: stock items, purchase orders, and what the PO forms need.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInSpace } from "@/lib/spaceAccess";
import { PO_INCLUDE, poApprovalLimit, poTotal } from "@/lib/purchaseOrders";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInSpace((await params).slug);
  if ("error" in s) return s.error;
  const { space, user } = s;
  const [items, pos, jobs, suppliers, limit] = await Promise.all([
    prisma.stockItem.findMany({
      where: { entityId: space.id, archived: false },
      include: { supplier: { select: { id: true, name: true } }, moves: { orderBy: { createdAt: "desc" }, take: 5, include: { job: { select: { id: true, title: true } }, user: { select: { name: true } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.purchaseOrder.findMany({ where: { entityId: space.id }, include: PO_INCLUDE, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.job.findMany({ where: { entityId: space.id, status: "active" }, select: { id: true, number: true, title: true }, orderBy: { createdAt: "desc" } }),
    prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    poApprovalLimit(),
  ]);
  return NextResponse.json({
    space, limit, canApprove: user.canApprove, isAdmin: user.role === "admin", me: user.userId,
    items: items.map(i => ({ ...i, low: i.reorderLevel != null && i.quantity <= i.reorderLevel })),
    pos: pos.map(p => ({ ...p, total: poTotal(p.lines) })),
    jobs, suppliers,
  });
}

/** Admins set the PO approval limit and the standard workshop day rate (£, ex VAT). */
export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInSpace((await params).slug);
  if ("error" in s) return s.error;
  if (s.user.role !== "admin") return NextResponse.json({ error: "Only admins can change these" }, { status: 403 });
  const body = await req.json();
  const out: Record<string, number | null> = {};
  if ("poApprovalLimit" in body) {
    const n = Number(body.poApprovalLimit);
    if (!isFinite(n) || n < 0 || n > 1_000_000) return NextResponse.json({ error: "Enter an amount in pounds" }, { status: 400 });
    await prisma.setting.upsert({ where: { key: "poApprovalLimit" }, update: { value: String(n) }, create: { key: "poApprovalLimit", value: String(n) } });
    out.limit = n;
  }
  if ("workshopDayRate" in body) {
    const blank = body.workshopDayRate === "" || body.workshopDayRate == null;
    const n = Number(body.workshopDayRate);
    if (!blank && (!isFinite(n) || n <= 0 || n > 10_000)) return NextResponse.json({ error: "Enter a day rate in pounds" }, { status: 400 });
    if (blank) await prisma.setting.deleteMany({ where: { key: "workshopDayRate" } });
    else await prisma.setting.upsert({ where: { key: "workshopDayRate" }, update: { value: String(n) }, create: { key: "workshopDayRate", value: String(n) } });
    out.workshopDayRate = blank ? null : n;
  }
  return NextResponse.json(out);
}
