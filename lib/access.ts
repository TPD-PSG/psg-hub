import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parsePerms, hiddenSectionsFor } from "@/lib/permissions";

type Access = { session: Session; role: string; userId: number; hidden: Set<string> } | { error: NextResponse };

// Same rule as the productions list: admins and all-productions staff see everything; everyone else only their teams.
// `section` (e.g. "budget", "crew") also refuses users who have that production tab hidden.
export async function requireProductionAccess(productionId: string | number, section?: string): Promise<Access> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; permissions?: string | null } | undefined;
  if (!session || !user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const pid = Number(productionId);
  if (!Number.isInteger(pid)) return { error: NextResponse.json({ error: "Invalid production" }, { status: 400 }) };

  const role = user.role ?? "member";
  const userId = Number(user.id);
  const hidden = hiddenSectionsFor(role, user.permissions);
  if (section && hidden.has(section)) {
    return { error: NextResponse.json({ error: "You don't have access to this section" }, { status: 403 }) };
  }
  if (role === "admin" || (role === "member" && parsePerms(user.permissions).allProductions)) {
    return { session, role, userId, hidden };
  }

  const onTeam = await prisma.productionTeam.findUnique({
    where: { productionId_userId: { productionId: pid, userId } },
    select: { id: true },
  });
  if (!onTeam) return { error: NextResponse.json({ error: "You don't have access to this production" }, { status: 403 }) };
  return { session, role, userId, hidden };
}

// Records that belong to a production, reached by their own id (e.g. /api/budget-lines/12).
// Each resolver returns the owning productionId, null if the record has no production, or undefined if not found.
const OWNER: Record<string, (id: number) => Promise<number | null | undefined>> = {
  budgetLine: id => prisma.budgetLine.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  budgetExpense: id => prisma.expense.findUnique({ where: { id }, select: { budgetLine: { select: { productionId: true } } } }).then(r => r?.budgetLine.productionId),
  spendDocument: id => prisma.spendDocument.findUnique({ where: { id }, select: { expense: { select: { budgetLine: { select: { productionId: true } } } } } }).then(r => r?.expense.budgetLine.productionId),
  budgetVariation: id => prisma.budgetVariation.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  callSheet: id => prisma.callSheet.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  callSheetEntry: id => prisma.callSheetEntry.findUnique({ where: { id }, select: { callSheet: { select: { productionId: true } } } }).then(r => r?.callSheet.productionId),
  event: id => prisma.event.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  hotelBooking: id => prisma.hotelBooking.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  hsDocument: id => prisma.hSDocument.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  keyDate: id => prisma.productionKeyDate.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  meeting: id => prisma.meeting.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  productionContact: id => prisma.productionContact.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  productionCrew: id => prisma.productionCrew.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  productionDocument: id => prisma.productionDocument.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  productionLink: id => prisma.productionLink.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  productionNote: id => prisma.productionNote.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  showReport: id => prisma.showReport.findUnique({ where: { id }, select: { productionId: true } }).then(r => r === null ? undefined : r?.productionId ?? null),
  staffAssignment: id => prisma.staffAssignment.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  taskList: id => prisma.taskList.findUnique({ where: { id }, select: { productionId: true } }).then(r => r === null ? undefined : r?.productionId ?? null),
  task: id => prisma.task.findUnique({ where: { id }, select: { productionId: true } }).then(r => r === null ? undefined : r?.productionId ?? null),
  tourStop: id => prisma.tourStop.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
  haulage: id => prisma.haulageMovement.findUnique({ where: { id }, select: { productionId: true } }).then(r => r?.productionId),
};

export type RecordKind = keyof typeof OWNER;

// Which production tab each record lives on, for hidden-section checks
const SECTION: Partial<Record<string, string>> = {
  budgetLine: "budget", budgetExpense: "budget", spendDocument: "budget", budgetVariation: "budget",
  productionCrew: "crew", productionLink: "links", hotelBooking: "accommodation", haulage: "haulage",
  callSheet: "callsheets", callSheetEntry: "callsheets", hsDocument: "hs", showReport: "reports",
  productionContact: "contacts", productionDocument: "documents", meeting: "meetings", productionNote: "notes",
};

export async function requireRecordAccess(kind: RecordKind, id: string | number): Promise<Access> {
  const rid = Number(id);
  if (!Number.isInteger(rid)) return { error: NextResponse.json({ error: "Invalid id" }, { status: 400 }) };
  const productionId = await OWNER[kind](rid);
  if (productionId === undefined) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (productionId === null) {
    // Not tied to a production (e.g. a company task): any signed-in user, routes apply their own rules
    const session = await auth();
    const user = session?.user as { id?: string; role?: string; permissions?: string | null } | undefined;
    if (!session || !user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    const role = user.role ?? "member";
    return { session, role, userId: Number(user.id), hidden: hiddenSectionsFor(role, user.permissions) };
  }
  return requireProductionAccess(productionId, SECTION[kind]);
}
