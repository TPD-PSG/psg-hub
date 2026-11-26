// A register document: any staff member who can see its item downloads it; admins can delete one
// uploaded by mistake (the page confirms first).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadFile, removeFile } from "@/lib/storage";
import { complianceViewer, register, visibleItems } from "@/lib/compliance";

async function find(rawId: string) {
  const v = await complianceViewer();
  if ("error" in v) return v;
  const id = Number(rawId);
  const doc = Number.isInteger(id) ? await prisma.complianceDocument.findFirst({ where: { id, item: visibleItems(v) } }) : null;
  if (!doc) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { v, doc };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const x = await find((await params).id);
  if ("error" in x) return x.error;
  const buf = await loadFile(x.doc.fileKey, x.doc.data);
  if (!buf) return NextResponse.json({ error: "File missing" }, { status: 404 });
  return new NextResponse(buf, { headers: { "Content-Type": x.doc.mime, "Content-Disposition": `inline; filename="${x.doc.name.replace(/"/g, "")}"`, "Cache-Control": "private, no-store" } });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const x = await find((await params).id);
  if ("error" in x) return x.error;
  if (!x.v.admin) return NextResponse.json({ error: "Only admins can delete a document" }, { status: 403 });
  await prisma.complianceDocument.delete({ where: { id: x.doc.id } });
  await removeFile(x.doc.fileKey);
  return NextResponse.json(await register(x.v));
}
