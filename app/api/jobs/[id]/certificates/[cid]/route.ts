// Remove a certificate (whoever added it, or an admin); its file goes too.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { removeFile } from "@/lib/storage";
import { jobAccess } from "@/lib/jobDesign";
import { certsFor } from "@/lib/frCerts";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const a = await jobAccess(id);
  if ("error" in a) return a.error;
  const c = await prisma.frCertificate.findFirst({ where: { id: parseInt(cid) || 0, jobId: a.id }, include: { file: { select: { id: true, fileKey: true } } } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.createdById !== a.v.userId && a.v.role !== "admin") return NextResponse.json({ error: "Only whoever added it, or an admin, can remove it" }, { status: 403 });
  await prisma.jobFile.delete({ where: { id: c.file.id } }); // the certificate goes with its file
  if (c.file.fileKey) await removeFile(c.file.fileKey).catch(() => {});
  return NextResponse.json(await certsFor(a.id));
}
