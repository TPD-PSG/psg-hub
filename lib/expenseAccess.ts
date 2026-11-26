// Who may see and change an expense claim's receipts (26 Nov 2026, audit round 2): the person who
// submitted it, or an admin. Same rule as the expenses list.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function expenseOwnerAccess(rawId: string | number): Promise<{ expenseId: number } | { error: NextResponse }> {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const id = Number(rawId);
  const e = Number.isInteger(id) ? await prisma.productionExpense.findUnique({ where: { id }, select: { id: true, submittedByUserId: true } }) : null;
  if (!e || (u.role !== "admin" && e.submittedByUserId !== Number(u.id))) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { expenseId: e.id };
}
