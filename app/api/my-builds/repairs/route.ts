// A client reports a problem with one of their builds (multipart, optional photo).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientViewer, clientBuilds, clientBrand } from "@/lib/clientPortal";
import { readReport, tellWorkshop } from "@/lib/repairs";

export async function POST(req: Request) {
  const v = await clientViewer();
  if ("error" in v) return v.error;
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Fill in the report" }, { status: 400 });
  const r = await readReport(form, { clientId: v.clientId });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  await prisma.repair.create({ data: { ...r.data, fromClient: true, reportedById: v.userId, reportedByName: `${v.name} (${v.clientName})` } });
  await tellWorkshop(r.job, r.data.title, `${v.name}, ${v.clientName}`, r.data.urgency);
  return NextResponse.json({ me: { name: v.name, company: v.clientName }, builds: await clientBuilds(v.clientId), brand: await clientBrand(v.clientId) }, { status: 201 });
}
