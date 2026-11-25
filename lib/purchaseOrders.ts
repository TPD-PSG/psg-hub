// TWS purchase orders and stock (decided 25 Nov 2026, defaults for Toby to review):
//   - any PSG staff can raise a PO; on submit, a PO up to the approval limit (default £250 ex VAT)
//     is approved straight away, above it waits for an admin or someone with Finance access
//   - delivering a PO adds its lines to the stock items they're linked to
//   - PO and stock costs are visible to all staff; job price and margin stay restricted
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccess, parsePerms } from "@/lib/permissions";

export { PO_STATUS } from "@/lib/poStatus";
export const DEFAULT_PO_LIMIT = 250;

export const poTotal = (lines: { quantity: number; unitCost: number }[]) => Math.round(lines.reduce((s, l) => s + l.quantity * l.unitCost, 0) * 100) / 100;

export async function poApprovalLimit(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: "poApprovalLimit" } });
  const n = Number(s?.value);
  return s && isFinite(n) && n >= 0 ? n : DEFAULT_PO_LIMIT;
}

export const canApprovePOs = (user: { role?: string; permissions?: string | null }) =>
  user.role === "admin" || (user.role === "member" && canAccess(parsePerms(user.permissions ?? null), "finance", "member"));

/** Value of stock booked out to each job (book-outs less returns), at the cost when it moved. */
export async function stockUsedByJob(jobIds: number[]) {
  const map = new Map<number, number>();
  if (!jobIds.length) return map;
  const moves = await prisma.stockMove.findMany({ where: { jobId: { in: jobIds }, kind: { in: ["book_out", "return"] } }, select: { jobId: true, change: true, unitCost: true } });
  for (const m of moves) map.set(m.jobId!, (map.get(m.jobId!) ?? 0) - m.change * (m.unitCost ?? 0));
  return map;
}

/** PO totals per job, for costing. */
export async function posByJob(jobIds: number[]) {
  const map = new Map<number, { status: string; total: number }[]>();
  if (!jobIds.length) return map;
  const pos = await prisma.purchaseOrder.findMany({ where: { jobId: { in: jobIds }, status: { not: "cancelled" } }, select: { jobId: true, status: true, lines: { select: { quantity: true, unitCost: true } } } });
  for (const p of pos) map.set(p.jobId!, [...(map.get(p.jobId!) ?? []), { status: p.status, total: poTotal(p.lines) }]);
  return map;
}


export type PoUser = { userId: number; role: string; canApprove: boolean };
/** PSG staff only (stock and POs). */
export async function requirePoUser(): Promise<PoUser | { error: NextResponse }> {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string; permissions?: string | null } | undefined;
  if (!u?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (u.role !== "admin" && u.role !== "member") return { error: NextResponse.json({ error: "PSG staff only" }, { status: 403 }) };
  return { userId: Number(u.id), role: u.role, canApprove: canApprovePOs(u) };
}

export const PO_INCLUDE = {
  lines: { orderBy: { sortOrder: "asc" as const } },
  job: { select: { id: true, number: true, title: true } },
  supplier: { select: { id: true, name: true, email: true, phone: true } },
  raisedBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
};

type LineIn = { description?: unknown; quantity?: unknown; unit?: unknown; unitCost?: unknown; stockItemId?: unknown };
/** Check PO lines; stock items must belong to the same company. */
export async function poLines(raw: unknown, entityId: number | null): Promise<{ lines: { description: string; quantity: number; unit: string | null; unitCost: number; stockItemId: number | null; sortOrder: number }[] } | { error: string }> {
  if (!Array.isArray(raw)) return { error: "Add at least one line" };
  const lines = [];
  for (const [i, l] of (raw as LineIn[]).entries()) {
    const description = typeof l.description === "string" ? l.description.trim() : "";
    if (!description) continue;
    const quantity = Number(l.quantity ?? 1), unitCost = Number(l.unitCost ?? 0);
    if (!isFinite(quantity) || quantity <= 0) return { error: `Line ${i + 1}: quantity must be more than 0` };
    if (!isFinite(unitCost) || unitCost < 0) return { error: `Line ${i + 1}: price can't be negative` };
    let stockItemId: number | null = null;
    if (l.stockItemId != null && l.stockItemId !== "") {
      stockItemId = Number(l.stockItemId);
      if (!(await prisma.stockItem.count({ where: { id: stockItemId, entityId: entityId ?? -1 } }))) return { error: `Line ${i + 1}: unknown stock item` };
    }
    lines.push({ description: description.slice(0, 200), quantity, unit: typeof l.unit === "string" && l.unit.trim() ? l.unit.trim().slice(0, 20) : null, unitCost, stockItemId, sortOrder: i });
  }
  if (!lines.length) return { error: "Add at least one line" };
  return { lines };
}
