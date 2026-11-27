// Checking what's sent for a rental product, unit, package or hire.
import { prisma } from "@/lib/prisma";
import { RENTAL_CATEGORIES, UNIT_STATUS, cleanBarcode, validBarcode, nextBarcodes } from "@/lib/rentals";
import { money, text } from "@/lib/rentalAccess";

type R<T> = { data: T } | { error: string };

export function productFields(b: Record<string, unknown>, creating: boolean): R<Record<string, unknown>> {
  const d: Record<string, unknown> = {};
  if (creating || "name" in b) {
    const n = text(b.name, 120);
    if (!n) return { error: "Give the product a name" };
    d.name = n;
  }
  if ("category" in b) {
    const c = text(b.category, 40);
    const known = (RENTAL_CATEGORIES as readonly string[]).find(k => k.toLowerCase() === c?.toLowerCase());
    d.category = known ?? c;
  }
  for (const k of ["manufacturer", "model"] as const) if (k in b) d[k] = text(b[k], 80);
  if ("notes" in b) d.notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim().slice(0, 2000) : null;
  for (const k of ["dayRate", "weekRate", "replacementCost", "weightKg", "powerW"] as const) {
    if (!(k in b)) continue;
    const n = money(b[k]);
    if (Number.isNaN(n)) return { error: `${k === "dayRate" ? "Day rate" : k === "weekRate" ? "Week rate" : k === "replacementCost" ? "Replacement cost" : k === "weightKg" ? "Weight" : "Power"} must be a number of 0 or more` };
    d[k] = n;
  }
  if ("isCase" in b) d.isCase = b.isCase === true;
  if ("archived" in b) d.archived = b.archived === true;
  return { data: d };
}

export function unitFields(b: Record<string, unknown>): R<Record<string, unknown>> {
  const d: Record<string, unknown> = {};
  if ("barcode" in b) {
    const c = cleanBarcode(b.barcode);
    if (!validBarcode(c)) return { error: "A barcode is 3 to 40 letters, numbers, dots, dashes or slashes" };
    d.barcode = c;
  }
  if ("serial" in b) d.serial = text(b.serial, 80);
  if ("location" in b) d.location = text(b.location, 80);
  if ("notes" in b) d.notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim().slice(0, 2000) : null;
  if ("status" in b) {
    if (typeof b.status !== "string" || !(b.status in UNIT_STATUS)) return { error: "Status is available, repair, lost or retired" };
    d.status = b.status;
  }
  if ("purchaseCost" in b) {
    const n = money(b.purchaseCost);
    if (Number.isNaN(n)) return { error: "Purchase cost must be a number of 0 or more" };
    d.purchaseCost = n;
  }
  if ("purchasedAt" in b) {
    if (b.purchasedAt === null || b.purchasedAt === "") d.purchasedAt = null;
    else {
      const t = new Date(String(b.purchasedAt));
      if (isNaN(t.getTime())) return { error: "Purchase date isn't a date" };
      d.purchasedAt = t;
    }
  }
  return { data: d };
}

/** Barcodes for new units: { barcodes: "A1\nA2" | [...] } as given, or { count: n } made up. */
export async function unitBarcodes(b: Record<string, unknown>, prefixFrom: string): Promise<{ list: string[] } | { error: string; status?: number }> {
  const given = Array.isArray(b.barcodes) ? b.barcodes : typeof b.barcodes === "string" ? b.barcodes.split(/[\n,;]+/) : [];
  const list = given.map(cleanBarcode).filter(Boolean);
  if (list.length) {
    const badOne = list.find(c => !validBarcode(c));
    if (badOne) return { error: `"${badOne}" isn't a barcode: use 3 to 40 letters, numbers, dots, dashes or slashes` };
    const dup = list.find((c, i) => list.indexOf(c) !== i);
    if (dup) return { error: `${dup} is in the list twice` };
    if (list.length > 500) return { error: "Add up to 500 units at a time" };
    const taken = await prisma.rentalUnit.findMany({ where: { barcode: { in: list } }, select: { barcode: true } });
    if (taken.length) return { error: `Already on another unit: ${taken.map(t => t.barcode).slice(0, 5).join(", ")}`, status: 409 };
    return { list };
  }
  const count = b.count === undefined || b.count === "" ? 0 : Number(b.count);
  if (!Number.isInteger(count) || count < 0 || count > 500) return { error: "Add between 0 and 500 units" };
  if (!count) return { list: [] };
  const prefix = (prefixFrom.match(/[A-Za-z0-9]/g) ?? []).join("").slice(0, 3) || "RC";
  const used = await prisma.rentalUnit.findMany({ where: { barcode: { startsWith: prefix.toUpperCase() } }, select: { barcode: true } });
  return { list: nextBarcodes(prefix, used.map(u => u.barcode), count) };
}

/** Package or hire lines: [{ productId, quantity }], each product from this company's kit. */
export type LineIn = { productId: number; quantity: number; note: string | null; dayRate?: number | null; weekRate?: number | null; unitPrice?: number | null; discountPct?: number | null };
const optNum = (l: Record<string, unknown>, k: string, max: number): number | null | undefined | "bad" => {
  if (!l || !(k in l)) return undefined;
  if (l[k] === null || l[k] === "") return null;
  const n = Number(l[k]);
  return isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : "bad";
};
export async function lineList(raw: unknown, entityId: number, max = 300): Promise<{ list: LineIn[] } | { error: string }> {
  if (!Array.isArray(raw)) return { error: "Lines must be a list" };
  if (raw.length > max) return { error: `Up to ${max} lines` };
  const list = [];
  for (const l of raw as Record<string, unknown>[]) {
    const productId = Number(l?.productId), quantity = Number(l?.quantity ?? 1);
    if (!Number.isInteger(productId)) return { error: "Each line needs a product" };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) return { error: "Quantities are whole numbers from 1" };
    const extra: Partial<LineIn> = {};
    for (const [k, mx, msg] of [["dayRate", 1e6, "Day rates are 0 or more"], ["weekRate", 1e6, "Week rates are 0 or more"], ["unitPrice", 1e7, "Prices are 0 or more"], ["discountPct", 100, "Discounts are 0 to 100%"]] as const) {
      const v = optNum(l, k, mx);
      if (v === "bad") return { error: msg };
      if (v !== undefined) extra[k] = v;
    }
    list.push({ productId, quantity, note: typeof l.note === "string" && l.note.trim() ? l.note.trim().slice(0, 200) : null, ...extra });
  }
  const ids = [...new Set(list.map(l => l.productId))];
  const found = await prisma.rentalProduct.count({ where: { id: { in: ids }, entityId } });
  if (found !== ids.length) return { error: "A line's product isn't in this company's kit" };
  return { list };
}

/** A sub-hire: what it stands in for, from whom, how many, what it costs us, and where it's got to. */
export async function subHireFields(b: Record<string, unknown>, entityId: number, creating: boolean): Promise<{ data: Record<string, unknown> } | { error: string }> {
  const d: Record<string, unknown> = {};
  if ("productId" in b) {
    if (b.productId == null || b.productId === "") d.productId = null;
    else {
      const p = await prisma.rentalProduct.findFirst({ where: { id: Number(b.productId), entityId }, select: { id: true, name: true } });
      if (!p) return { error: "That product isn't in this company's kit" };
      d.productId = p.id;
      if (!text(b.description, 200)) d.description = p.name; // defaults to the product's name
    }
  }
  if ("description" in b && text(b.description, 200)) d.description = text(b.description, 200);
  if (creating && !d.description) return { error: "Say what's being sub-hired" };
  if (creating || "quantity" in b) {
    const q = Number(b.quantity ?? 1);
    if (!Number.isInteger(q) || q < 1 || q > 10_000) return { error: "The quantity is a whole number from 1" };
    d.quantity = q;
  }
  if ("supplierId" in b) {
    if (b.supplierId == null || b.supplierId === "") d.supplierId = null;
    else {
      const s = await prisma.supplier.findUnique({ where: { id: Number(b.supplierId) }, select: { id: true } });
      if (!s) return { error: "No such supplier" };
      d.supplierId = s.id;
    }
  }
  if ("supplierName" in b) d.supplierName = text(b.supplierName, 120);
  if ("cost" in b) {
    const n = money(b.cost);
    if (Number.isNaN(n)) return { error: "The cost is a number of 0 or more" };
    d.cost = n;
  }
  if ("status" in b) {
    if (typeof b.status !== "string" || !["needed", "ordered", "received", "returned"].includes(b.status)) return { error: "Status is needed, ordered, received or returned" };
    d.status = b.status;
  }
  if ("notes" in b) d.notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim().slice(0, 1000) : null;
  return { data: d };
}
