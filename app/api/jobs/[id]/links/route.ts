// Add a file link to a job (VectorWorks drawings, cut lists… where they live on OneDrive/SharePoint)
import { denyOutOfScope } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobViewer } from "@/lib/jobData";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outOfScope = await denyOutOfScope("job", (await params).id); // companies they can see
  if (outOfScope) return outOfScope;
  const v = await requireJobViewer();
  if ("error" in v) return v.error;
  const jobId = parseInt((await params).id);
  if (!(await prisma.job.count({ where: { id: jobId } }))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!label) return NextResponse.json({ error: "Name the file" }, { status: 400 });
  let parsed: URL;
  try { parsed = new URL(url); } catch { return NextResponse.json({ error: "Paste the file's full link (https://…)" }, { status: 400 }); }
  if (parsed.protocol !== "https:") return NextResponse.json({ error: "Links must start with https://" }, { status: 400 });
  const kind = ["vectorworks", "drawing", "other"].includes(body.kind) ? body.kind : "vectorworks";
  const link = await prisma.jobLink.create({ data: { jobId, label: label.slice(0, 120), url: parsed.toString().slice(0, 2000), kind } });
  return NextResponse.json(link, { status: 201 });
}
