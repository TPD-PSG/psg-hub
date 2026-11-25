// "+ New build job" in a company space: any PSG staff who can open the space can start a workshop
// build for that company. No price here; directors, BD or finance add that on the Jobs page or
// from an accepted quote. It starts at the Quote stage.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInSpace } from "@/lib/spaceAccess";
import { newNumber } from "@/lib/quoteData";
import { dayUtc } from "@/lib/buildParts";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await staffInSpace((await params).slug);
  if ("error" in s) return s.error;
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "Give the build a name" }, { status: 400 });
  const num = (v: unknown) => (v === "" || v == null ? null : Number(v));
  const clientId = num(body.clientId), forProductionId = num(body.forProductionId);
  if (clientId !== null && !(await prisma.client.count({ where: { id: clientId } }))) return NextResponse.json({ error: "Unknown client" }, { status: 400 });
  if (forProductionId !== null && !(await prisma.production.count({ where: { id: forProductionId } }))) return NextResponse.json({ error: "Unknown production" }, { status: 400 });
  const deliveryMethod = ["collection", "delivery"].includes(body.deliveryMethod) ? body.deliveryMethod : null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const job = await prisma.job.create({
        data: {
          number: await newNumber("J"), title, jobType: "workshop", entityId: s.space.id, clientId, forProductionId,
          startDate: dayUtc(body.startDate), endDate: dayUtc(body.dueOut), deliveryMethod,
          notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 2000) : null,
          stage: "quote", stageChangedAt: new Date(),
        },
        select: { id: true, number: true, title: true },
      });
      return NextResponse.json(job, { status: 201 });
    } catch (e) {
      if (!(e instanceof Error) || !/Unique constraint/i.test(e.message) || attempt === 2) throw e;
    }
  }
}
