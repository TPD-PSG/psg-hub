// Upload a document for an item (admins or its owner). With renew=1 it also moves the item's dates
// on: the new certificate or schedule becomes current and the old one stays in the history.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { complianceViewer, register, visibleItems, canManage, addDocument, dateOrNull, text } from "@/lib/compliance";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const v = await complianceViewer();
  if ("error" in v) return v.error;
  const id = Number((await params).id);
  const item = Number.isInteger(id) ? await prisma.complianceItem.findFirst({ where: { id, ...visibleItems(v) }, select: { id: true, ownerId: true, category: true } }) : null;
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManage(v, item)) return NextResponse.json({ error: "Only admins or this item's owner can upload" }, { status: 403 });
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a file" }, { status: 400 });
  const meta = { validFrom: dateOrNull(fd!.get("validFrom")), expiresAt: dateOrNull(fd!.get("expiresAt")), version: text(fd!.get("version"), 60) };
  const r = await addDocument(item.id, file, meta, v.userId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  if (fd!.get("renew") === "1") {
    // Policies move their review date; everything else its renewal date
    const next = item.category === "policy" ? { reviewAt: meta.expiresAt } : { expiresAt: meta.expiresAt };
    await prisma.complianceItem.update({ where: { id: item.id }, data: { ...(meta.validFrom ? { validFrom: meta.validFrom } : {}), ...(meta.expiresAt ? next : {}), ...(meta.version ? { version: meta.version } : {}) } });
  }
  return NextResponse.json(await register(v), { status: 201 });
}
