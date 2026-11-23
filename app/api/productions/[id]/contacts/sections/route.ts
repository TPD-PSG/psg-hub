import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";
import { cleanSections } from "@/lib/contactSections";

export const dynamic = "force-dynamic";

// PUT { sections: string[] } — this production's own contact-sheet sections
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id, "contacts");
  if ("error" in access) return access.error;
  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.sections)) return NextResponse.json({ error: "sections must be a list" }, { status: 400 });
  const sections = cleanSections(body.sections);
  await prisma.production.update({ where: { id: Number(id) }, data: { contactSections: JSON.stringify(sections) } });
  return NextResponse.json({ sections });
}
