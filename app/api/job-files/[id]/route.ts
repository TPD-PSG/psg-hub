// One design file of a build: opened by PSG staff who can see the build; deleted by its uploader or an admin.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadFile, removeFile } from "@/lib/storage";
import { jobAccess } from "@/lib/jobDesign";

const find = async (params: Promise<{ id: string }>) => prisma.jobFile.findUnique({ where: { id: parseInt((await params).id) } });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const f = await find(params);
  if (!f) return new Response("Not found", { status: 404 });
  const a = await jobAccess(String(f.jobId));
  if ("error" in a) return a.error;
  const bytes = await loadFile(f.fileKey, f.data).catch(() => null);
  if (!bytes) return new Response("Not found", { status: 404 });
  const name = f.name.replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": f.mime, "Content-Disposition": `inline; filename="${name}"`, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const f = await find(params);
  if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = await jobAccess(String(f.jobId));
  if ("error" in a) return a.error;
  if (f.uploadedById !== a.v.userId && a.v.role !== "admin") return NextResponse.json({ error: "Only the person who added it (or an admin) can delete it" }, { status: 403 });
  await prisma.jobFile.delete({ where: { id: f.id } });
  if (f.fileKey) await removeFile(f.fileKey).catch(() => {});
  return NextResponse.json({ ok: true });
}
