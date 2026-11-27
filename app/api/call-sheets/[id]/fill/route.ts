// Adds the crew and PSG staff booked on the sheet's day who aren't on it yet (bookings made after
// the sheet was started). Nobody already on the sheet is changed.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRecordAccess } from "@/lib/access";
import { peopleForDay, touchSheet } from "@/lib/callSheets";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await requireRecordAccess("callSheet", id);
  if ("error" in rec) return rec.error;
  const sheet = await prisma.callSheet.findUnique({ where: { id: Number(id) }, select: { id: true, productionId: true, date: true, entries: { select: { crewId: true, userId: true, sortOrder: true } } } });
  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const haveCrew = new Set(sheet.entries.map(e => e.crewId).filter(Boolean));
  const haveUser = new Set(sheet.entries.map(e => e.userId).filter(Boolean));
  const add = (await peopleForDay(sheet.productionId, sheet.date)).filter(p => (p.crewId ? !haveCrew.has(p.crewId) : !haveUser.has(p.userId)));
  const next = Math.max(0, ...sheet.entries.map(e => e.sortOrder + 1));
  if (add.length) {
    await prisma.callSheetEntry.createMany({ data: add.map((p, i) => ({ ...p, callSheetId: sheet.id, sortOrder: next + i })) });
    await touchSheet(sheet.id);
  }
  return NextResponse.json({ added: add.length });
}
