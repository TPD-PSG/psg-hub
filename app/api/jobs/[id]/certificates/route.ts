// A build's flame-retardant certificates: list and add (PSG staff who can see the build).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { jobAccess, FILE_MAX } from "@/lib/jobDesign";
import { certsFor, CERT_KINDS } from "@/lib/frCerts";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  return NextResponse.json(await certsFor(a.id));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  const text = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max) || null;
  const title = text("title", 150);
  const file = form.get("file");
  if (!title) return NextResponse.json({ error: "Say what the certificate covers" }, { status: 400 });
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose the certificate (PDF or photo)" }, { status: 400 });
  if (!CERT_KINDS.includes(file.type)) return NextResponse.json({ error: "Certificates must be PDF, JPEG, PNG or WebP" }, { status: 400 });
  if (file.size > FILE_MAX) return NextResponse.json({ error: "The certificate is over 25 MB" }, { status: 400 });
  const day = (k: string) => { const v = text(k, 10); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null; };
  const stored = await saveFile("job-files", file.name, await file.arrayBuffer(), file.type);
  await prisma.frCertificate.create({
    data: {
      job: { connect: { id: a.id } }, title, standard: text("standard", 80), supplier: text("supplier", 120), issuedAt: day("issuedAt"), expiresAt: day("expiresAt"), createdById: a.v.userId,
      file: { create: { jobId: a.id, kind: "certificate", name: file.name.slice(0, 200), mime: file.type, size: file.size, fileKey: stored.key, data: stored.base64, uploadedById: a.v.userId } },
    },
  });
  return NextResponse.json(await certsFor(a.id), { status: 201 });
}
