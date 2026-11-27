// An entity's yearly revenue target (admins only). { year, amount } sets it; amount null or "" clears it.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const entityId = parseInt((await params).id);
  const body = await req.json().catch(() => ({}));
  const year = Number(body.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return NextResponse.json({ error: "Year required" }, { status: 400 });
  if (!(await prisma.entity.count({ where: { id: entityId } }))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (body.amount === null || body.amount === "" || body.amount === undefined) {
    await prisma.revenueTarget.deleteMany({ where: { entityId, year } });
    return NextResponse.json({ ok: true, cleared: true });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "Target must be a positive amount" }, { status: 400 });
  const target = await prisma.revenueTarget.upsert({
    where: { entityId_year: { entityId, year } },
    update: { amount },
    create: { entityId, year, amount },
    select: { year: true, amount: true },
  });
  return NextResponse.json(target);
}
