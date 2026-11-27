// The warehouse side of a hire (PSG Rentals & Crew, stage 3): scanning units out and back in,
// damage and missing kit, and prep progress against the hire's lines and sub-hires.
import { prisma } from "@/lib/prisma";
import { prepProgress, cleanBarcode } from "@/lib/rentals";

export async function warehouseView(hireId: number) {
  const hire = await prisma.rentalHire.findUnique({
    where: { id: hireId },
    select: {
      id: true, entityId: true, number: true, title: true, status: true, clientName: true, outDate: true, returnDate: true, delivery: true, deliveryTo: true,
      lines: { orderBy: { sortOrder: "asc" }, select: { productId: true, quantity: true, note: true, product: { select: { name: true, category: true } } } },
      subHires: { include: { product: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
      units: {
        orderBy: { outAt: "desc" },
        include: { unit: { select: { id: true, barcode: true, serial: true, location: true, containerId: true, product: { select: { id: true, name: true, category: true, replacementCost: true } } } }, outBy: { select: { name: true } }, backBy: { select: { name: true } } },
      },
    },
  });
  if (!hire) return null;
  const progress = prepProgress(hire.lines, hire.subHires, hire.units.map(u => ({ productId: u.unit.product.id, back: !!u.backAt })));
  const names = new Map<number, string>([...hire.lines.map(l => [l.productId, l.product.name] as const), ...hire.units.map(u => [u.unit.product.id, u.unit.product.name] as const)]);
  // Where to find what's still to scan: shelves of available units not out anywhere
  const want = progress.rows.filter(r => r.toScan > 0).map(r => r.productId);
  const shelves = want.length ? await prisma.rentalUnit.findMany({
    where: { productId: { in: want }, status: "available", hireUnits: { none: { backAt: null } } },
    select: { productId: true, location: true }, take: 500,
  }) : [];
  const where = new Map<number, string[]>();
  for (const u of shelves) if (u.location) where.set(u.productId, [...new Set([...(where.get(u.productId) ?? []), u.location])].slice(0, 4));
  return {
    hire, progress: { ...progress, rows: progress.rows.map(r => ({ ...r, name: names.get(r.productId) ?? "Product", shelves: where.get(r.productId) ?? [] })), extra: progress.extra.map(x => ({ ...x, name: names.get(x.productId) ?? "Product" })) },
  };
}

type ScanResult = { ok: true; message: string; barcodes: string[]; hireId: number } | { ok: false; message: string; status: number };

/**
 * Scan a unit out on a hire. A case brings everything packed in it. Units of products that
 * aren't on the hire are refused unless they're a case or came in one. Nothing goes out twice,
 * or while in repair, lost or retired, or beyond what the hire needs from our own kit.
 */
export async function scanOut(hireId: number, rawCode: unknown, userId: number): Promise<ScanResult> {
  const code = cleanBarcode(rawCode);
  if (!code) return { ok: false, message: "Scan or type a barcode", status: 400 };
  const view = await warehouseView(hireId);
  if (!view) return { ok: false, message: "Not found", status: 404 };
  const { hire, progress } = view;
  if (!["confirmed", "out"].includes(hire.status)) return { ok: false, message: hire.status === "quote" ? "Confirm the hire before prepping it" : "This hire is closed", status: 400 };
  const unit = await prisma.rentalUnit.findFirst({
    where: { barcode: code, product: { entityId: hire.entityId } },
    include: { product: { select: { id: true, name: true, isCase: true } }, contents: { include: { product: { select: { id: true, name: true } } } }, hireUnits: { where: { backAt: null }, include: { hire: { select: { id: true, number: true } } } } },
  });
  if (!unit) return { ok: false, message: `Nothing here has the barcode ${code}`, status: 404 };
  const group = [unit, ...(unit.product.isCase ? unit.contents.map(c => ({ ...c, product: { ...c.product, isCase: false } })) : [])];
  const allIds = group.map(g => g.id);
  const open = await prisma.rentalHireUnit.findMany({ where: { unitId: { in: allIds }, backAt: null }, include: { hire: { select: { id: true, number: true } }, unit: { select: { barcode: true } } } });
  const here = open.filter(o => o.hire.id === hire.id), elsewhere = open.filter(o => o.hire.id !== hire.id);
  if (here.some(o => o.unitId === unit.id)) return { ok: false, message: `${code} is already scanned out on this hire`, status: 409 };
  if (elsewhere.length) return { ok: false, message: `${elsewhere[0].unit.barcode} is still out on ${elsewhere[0].hire.number}. Check it in there first.`, status: 409 };
  const units = await prisma.rentalUnit.findMany({ where: { id: { in: allIds } }, select: { id: true, barcode: true, status: true } });
  const notReady = units.find(u => u.status !== "available");
  if (notReady) return { ok: false, message: `${notReady.barcode} is marked ${notReady.status === "repair" ? "in repair" : notReady.status}, so it can't go out`, status: 409 };
  // Only what the hire needs from our kit (cases, and things packed in them, ride along)
  const row = progress.rows.find(r => r.productId === unit.product.id);
  if (!unit.product.isCase) {
    if (!row) return { ok: false, message: `${unit.product.name} isn't on this hire. Add it to the hire first.`, status: 409 };
    if (row.toScan <= 0) return { ok: false, message: `All ${row.fromUs} ${unit.product.name} for this hire are already scanned`, status: 409 };
  }
  const fresh = group.filter(g => !here.some(o => o.unitId === g.id));
  await prisma.$transaction([
    prisma.rentalHireUnit.createMany({ data: fresh.map(g => ({ hireId: hire.id, unitId: g.id, outById: userId })) }),
    ...(hire.status === "confirmed" ? [prisma.rentalHire.update({ where: { id: hire.id }, data: { status: "out" } })] : []), // the first scan sends it out
  ]);
  const inside = fresh.length - 1;
  return { ok: true, hireId: hire.id, barcodes: fresh.map(g => g.barcode), message: `${unit.product.name} ${code} out${inside > 0 ? `, with the ${inside} unit${inside === 1 ? "" : "s"} packed in it` : ""}` };
}

/**
 * Scan a unit back in. It's checked in on whichever hire it's out on (saying so if that's not the
 * hire on screen). When everything on a hire is back, the hire is marked returned.
 */
export async function scanIn(entityId: number, rawCode: unknown, userId: number, onHireId?: number): Promise<ScanResult> {
  const code = cleanBarcode(rawCode);
  if (!code) return { ok: false, message: "Scan or type a barcode", status: 400 };
  const unit = await prisma.rentalUnit.findFirst({ where: { barcode: code, product: { entityId } }, include: { product: { select: { name: true, isCase: true } }, contents: { select: { id: true } } } });
  if (!unit) return { ok: false, message: `Nothing here has the barcode ${code}`, status: 404 };
  const open = await prisma.rentalHireUnit.findFirst({ where: { unitId: unit.id, backAt: null }, include: { hire: { select: { id: true, number: true } } } });
  if (!open) return { ok: false, message: `${unit.product.name} ${code} isn't out on any hire`, status: 409 };
  // A case brings back what's still packed in it on the same hire
  const ids = [unit.id, ...(unit.product.isCase ? unit.contents.map(c => c.id) : [])];
  const now = new Date();
  const r = await prisma.rentalHireUnit.updateMany({ where: { hireId: open.hire.id, unitId: { in: ids }, backAt: null }, data: { backAt: now, backById: userId, condition: "ok" } });
  await closeIfAllBack(open.hire.id);
  const elsewhere = onHireId && onHireId !== open.hire.id ? ` (it was out on ${open.hire.number})` : "";
  return { ok: true, hireId: open.hire.id, barcodes: [code], message: `${unit.product.name} ${code} back in${r.count > 1 ? `, with ${r.count - 1} packed in it` : ""}${elsewhere}` };
}

export async function closeIfAllBack(hireId: number) {
  const [outNow, any, h] = await Promise.all([
    prisma.rentalHireUnit.count({ where: { hireId, backAt: null } }),
    prisma.rentalHireUnit.count({ where: { hireId } }),
    prisma.rentalHire.findUnique({ where: { id: hireId }, select: { status: true } }),
  ]);
  if (any > 0 && outNow === 0 && h?.status === "out") await prisma.rentalHire.update({ where: { id: hireId }, data: { status: "returned" } });
}
