// One hire: its lines and what it's short of. Confirming checks the kit is free over its dates.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, notFound, bad } from "@/lib/rentalAccess";
import { hireFields, withRates, HIRE_INCLUDE, shortFor, holdsKit, hireOut } from "@/lib/rentalHires";

const load = (id: number) => prisma.rentalHire.findUnique({ where: { id }, select: { id: true, entityId: true, status: true, outDate: true, returnDate: true } });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = await load(parseInt((await params).id));
  if (!h) return notFound();
  const a = await staffForEntity(h.entityId);
  if ("error" in a) return a.error;
  return NextResponse.json(await hireOut((await prisma.rentalHire.findUnique({ where: { id: h.id }, include: HIRE_INCLUDE }))!));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = await load(parseInt((await params).id));
  if (!h) return notFound();
  const a = await staffForEntity(h.entityId);
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const f = await hireFields(b, h.entityId, false, h);
  if ("error" in f) return bad(f.error!);
  if (["returned", "cancelled"].includes(h.status) && f.lines) return bad("This hire is closed; reopen it as a quote to change its kit");
  if (b.quoteSent === true) f.data.quoteSentAt = new Date(); // marked as sent to the client
  if (b.quoteSent === false) f.data.quoteSentAt = null;
  if (f.charges) {
    await prisma.rentalHireCharge.deleteMany({ where: { hireId: h.id } });
    f.data.charges = { create: f.charges };
  }
  const status = (f.data.status as string | undefined) ?? h.status;
  // Leaving "out" while units are still out would strand them: check them in (or mark them missing) first
  if (h.status === "out" && status !== "out") {
    const still = await prisma.rentalHireUnit.count({ where: { hireId: h.id, backAt: null } });
    if (still) return bad(`${still} unit${still === 1 ? " is" : "s are"} still out on this hire. Check ${still === 1 ? "it" : "them"} in on Warehouse, or mark ${still === 1 ? "it" : "them"} missing, first.`, 409);
  }
  // Holding kit (confirming, or changing a confirmed hire) needs it free, unless they'll sub-hire the rest
  if (holdsKit(status)) {
    const lines = f.lines ?? (await prisma.rentalHireLine.findMany({ where: { hireId: h.id }, select: { productId: true, quantity: true } }));
    const short = await shortFor(h.entityId, { id: h.id, outDate: f.outDate, returnDate: f.returnDate, lines });
    if (short.length && b.allowShort !== true) return NextResponse.json({ error: `Not enough free: ${short.map(s => `${s.name} (${s.free} free, ${s.wanted} wanted)`).join("; ")}`, shortages: short }, { status: 409 });
  }
  if (f.lines) {
    await prisma.rentalHireLine.deleteMany({ where: { hireId: h.id } });
    f.data.lines = { create: await withRates(f.lines) };
  }
  return NextResponse.json(await hireOut(await prisma.rentalHire.update({ where: { id: h.id }, data: f.data, include: HIRE_INCLUDE })));
}

/** Only quotes and cancelled hires can be deleted; anything that went out stays on record. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = await load(parseInt((await params).id));
  if (!h) return notFound();
  const a = await staffForEntity(h.entityId);
  if ("error" in a) return a.error;
  if (!["quote", "cancelled"].includes(h.status)) return bad("Cancel the hire instead: confirmed and returned hires stay on record");
  if (await prisma.rentalHire.count({ where: { id: h.id, invoiceId: { not: null } } })) return bad("This hire has an invoice in Finance, so it stays on record");
  await prisma.rentalHire.delete({ where: { id: h.id } });
  return NextResponse.json({ deleted: true });
}
