import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/quoteData";

// Delete a template (PSG staff); quotes made from it keep their lines
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireStaff();
  if ("error" in who) return who.error;
  const { count } = await prisma.quoteTemplate.deleteMany({ where: { id: parseInt((await params).id) } });
  return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
