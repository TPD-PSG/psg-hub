// Record a check's result (workshop staff): pass sets the next due date; fail puts the item out of use.
import { NextRequest, NextResponse } from "next/server";
import { equipmentList, recordCheck } from "@/lib/equipment";
import { checkFor } from "@/lib/checkRoute";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const x = await checkFor((await params).id);
  if ("error" in x) return x.error;
  if (!x.v.staff) return NextResponse.json({ error: "Only the workshop's staff can record checks" }, { status: 403 });
  const r = await recordCheck(x.c, x.v.userId, await req.json().catch(() => ({})));
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(await equipmentList(x.v), { status: 201 });
}
