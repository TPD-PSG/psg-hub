// The group compliance register: GET for staff; POST (admins) adds an item.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { complianceViewer, register, itemFields } from "@/lib/compliance";

export const dynamic = "force-dynamic";

export async function GET() {
  const v = await complianceViewer();
  if ("error" in v) return v.error;
  return NextResponse.json(await register(v));
}

export async function POST(req: NextRequest) {
  const v = await complianceViewer();
  if ("error" in v) return v.error;
  if (!v.admin) return NextResponse.json({ error: "Only admins add to the register" }, { status: 403 });
  const f = await itemFields(await req.json().catch(() => ({})), true, v);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  const item = await prisma.complianceItem.create({ data: f.data as never });
  return NextResponse.json({ id: item.id, ...(await register(v)) }, { status: 201 });
}
