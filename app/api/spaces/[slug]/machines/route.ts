// A workshop's machines and inductions matrix (GET); add a machine (POST, the workshop's staff).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workshopViewer, matrix } from "@/lib/inductions";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const v = await workshopViewer((await params).slug);
  if ("error" in v) return v.error;
  return NextResponse.json(await matrix(v));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const v = await workshopViewer((await params).slug);
  if ("error" in v) return v.error;
  if (!v.staff) return NextResponse.json({ error: "Only the workshop's staff can add machines" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.usual) {
    // A starter list for a scenic workshop, if there are none yet
    if (await prisma.machine.count({ where: { entityId: v.space.id } })) return NextResponse.json({ error: "There are machines already" }, { status: 409 });
    const usual = ["Panel saw", "Table saw", "Bandsaw", "Mitre saw", "Pillar drill", "Router table", "Spindle moulder", "Planer / thicknesser", "MIG welder", "Angle grinder", "Pallet truck", "Forklift", "Scissor lift", "Spray booth"];
    await prisma.machine.createMany({ data: usual.map(name => ({ entityId: v.space.id, name })) });
    return NextResponse.json(await matrix(v), { status: 201 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "Name the machine" }, { status: 400 });
  const months = body.refresherMonths === "" || body.refresherMonths == null ? 12 : Number(body.refresherMonths);
  if (!Number.isInteger(months) || months < 0 || months > 120) return NextResponse.json({ error: "Refresher is a number of months (0 for none)" }, { status: 400 });
  await prisma.machine.create({ data: { entityId: v.space.id, name, refresherMonths: months, location: typeof body.location === "string" ? body.location.trim().slice(0, 80) || null : null } });
  return NextResponse.json(await matrix(v), { status: 201 });
}
