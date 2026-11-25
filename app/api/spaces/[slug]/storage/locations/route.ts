// Add a storage location to a space (staff).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spaceMember } from "@/lib/spaceBoard";
import { storageFor } from "@/lib/setStorage";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const m = await spaceMember((await params).slug);
  if ("error" in m) return m.error;
  if (!m.staff) return NextResponse.json({ error: "Only staff can add locations" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "Name the location" }, { status: 400 });
  if (await prisma.storageLocation.count({ where: { entityId: m.space.id, name } })) return NextResponse.json({ error: `There's already a location called ${name}` }, { status: 409 });
  await prisma.storageLocation.create({ data: { entityId: m.space.id, name, notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 300) : null } });
  return NextResponse.json(await storageFor(m.space.id), { status: 201 });
}
