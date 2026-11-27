// A build's design files: the designer's drawings (PDF or image) and model box photos. PSG staff.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { jobAccess, FILE_KINDS, FILE_MAX, FILE_SELECT, fileUrl } from "@/lib/jobDesign";

// Drawing revisions (sign-off), certificates and repair photos are listed in their own sections
const list = async (jobId: number) => (await prisma.jobFile.findMany({ where: { jobId, revision: { is: null }, kind: { in: ["design", "modelbox"] } }, select: FILE_SELECT, orderBy: { createdAt: "desc" } })).map(f => ({ ...f, url: fileUrl(f.id) }));

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  return NextResponse.json(await list(a.id));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  const kind = String(form.get("kind") ?? "design") as keyof typeof FILE_KINDS;
  if (!(kind in FILE_KINDS)) return NextResponse.json({ error: "Drawings or model box photos" }, { status: 400 });
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 12);
  if (!files.length) return NextResponse.json({ error: "Choose a file" }, { status: 400 });
  for (const f of files) {
    if (!(FILE_KINDS[kind] as readonly string[]).includes(f.type)) return NextResponse.json({ error: kind === "modelbox" ? "Model box photos must be JPEG, PNG or WebP" : "Drawings must be PDF, JPEG, PNG or WebP" }, { status: 400 });
    if (f.size > FILE_MAX) return NextResponse.json({ error: `${f.name} is over 25 MB` }, { status: 400 });
  }
  const caption = String(form.get("caption") ?? "").trim().slice(0, 200) || null;
  for (const f of files) {
    const stored = await saveFile("job-files", f.name, await f.arrayBuffer(), f.type);
    await prisma.jobFile.create({ data: { jobId: a.id, kind, name: f.name.slice(0, 200), mime: f.type, size: f.size, fileKey: stored.key, data: stored.base64, caption, uploadedById: a.v.userId } });
  }
  return NextResponse.json(await list(a.id), { status: 201 });
}
