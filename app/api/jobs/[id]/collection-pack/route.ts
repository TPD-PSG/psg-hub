// Everything for a build's collection pack (27 Nov 2026): the build, its pieces with sizes and
// weights (the load list), FR certificates, drawings and the ready-to-collect checks. No money.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jobAccess } from "@/lib/jobDesign";
import { certsFor } from "@/lib/frCerts";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await jobAccess((await params).id);
  if ("error" in a) return a.error;
  const job = await prisma.job.findUnique({
    where: { id: a.id },
    select: {
      number: true, title: true, endDate: true, deliveryMethod: true,
      client: { select: { name: true, address: true } }, forProduction: { select: { name: true } },
      entity: { select: { name: true, hasSpace: true, slug: true, color: true, logoMime: true, updatedAt: true } },
      storedPieces: { orderBy: { id: "asc" }, select: { id: true, name: true, quantity: true, lengthMm: true, widthMm: true, heightMm: true, weightKg: true, outAt: true, location: { select: { name: true } } } },
      drawings: { orderBy: [{ number: "asc" }, { createdAt: "asc" }], select: { number: true, title: true, revisions: { orderBy: { createdAt: "desc" }, take: 1, select: { rev: true, status: true } } } },
      checks: { where: { kind: "collect" }, orderBy: { sortOrder: "asc" }, select: { text: true, done: true } },
    },
  }).catch(() => null);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...job, certs: await certsFor(a.id) });
}
