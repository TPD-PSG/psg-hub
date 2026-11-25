// A build's drawings for sign-off: list (with revisions and the decision log), and add a new
// drawing with its first revision (A). PSG staff.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { jobAccess, FILE_KINDS, FILE_MAX } from "@/lib/jobDesign";
import { gateOverrides, drawingsFor, gateBlockers } from "@/lib/drawings";
import { notifyClientOfDrawing } from "@/lib/clientPortal";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  return NextResponse.json({ drawings: await drawingsFor(a.id), blockers: await gateBlockers(a.id), overrides: await gateOverrides(a.id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  const form = await req.formData();
  const title = String(form.get("title") ?? "").trim().slice(0, 150);
  const number = String(form.get("number") ?? "").trim().slice(0, 30) || null;
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  const file = form.get("file");
  if (!title) return NextResponse.json({ error: "Give the drawing a title" }, { status: 400 });
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose the drawing file" }, { status: 400 });
  if (!(FILE_KINDS.design as readonly string[]).includes(file.type)) return NextResponse.json({ error: "Drawings must be PDF, JPEG, PNG or WebP" }, { status: 400 });
  if (file.size > FILE_MAX) return NextResponse.json({ error: "The drawing is over 25 MB" }, { status: 400 });
  if (number && (await prisma.drawing.count({ where: { jobId: a.id, number } }))) return NextResponse.json({ error: `There's already a drawing ${number} on this build; upload a new revision of it instead` }, { status: 409 });
  const stored = await saveFile("job-files", file.name, await file.arrayBuffer(), file.type);
  await prisma.drawing.create({
    data: {
      jobId: a.id, number, title,
      revisions: { create: { rev: "A", note, file: { create: { jobId: a.id, kind: "design", name: file.name.slice(0, 200), mime: file.type, size: file.size, fileKey: stored.key, data: stored.base64, uploadedById: a.v.userId } } } },
    },
  });
  await notifyClientOfDrawing(a.id, `${number ? `${number} ` : ""}${title}, rev A`).catch(() => {});
  return NextResponse.json({ drawings: await drawingsFor(a.id), blockers: await gateBlockers(a.id), overrides: await gateOverrides(a.id) }, { status: 201 });
}
