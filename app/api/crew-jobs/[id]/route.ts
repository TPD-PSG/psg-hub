// Change or remove a crew job. Changes keep the hire's crew charge in step; removing a job with
// people booked tells them they're no longer needed.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jobAccess, jobFields, JOB_INCLUDE, jobSummary, syncHireCharge, tellCrew } from "@/lib/crewOffers";

const load = (id: number) => prisma.crewJob.findUnique({ where: { id }, select: { id: true, hireId: true, productionId: true, places: true } });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const j = await load(parseInt((await params).id));
  if (!j) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = await jobAccess(j);
  if ("error" in a) return a.error;
  const f = jobFields(await req.json().catch(() => ({})), false);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  if (f.data.places !== undefined) {
    const booked = await prisma.crewOffer.count({ where: { jobId: j.id, status: "booked" } });
    if ((f.data.places as number) < booked) return NextResponse.json({ error: `${booked} people are booked: release some before cutting the places to ${f.data.places}` }, { status: 409 });
  }
  await prisma.crewJob.update({ where: { id: j.id }, data: f.data });
  await syncHireCharge(j.id);
  const job = (await prisma.crewJob.findUnique({ where: { id: j.id }, include: JOB_INCLUDE }))!;
  return NextResponse.json({ ...job, summary: jobSummary(job) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const j = await load(parseInt((await params).id));
  if (!j) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = await jobAccess(j);
  if ("error" in a) return a.error;
  const job = (await prisma.crewJob.findUnique({ where: { id: j.id }, include: JOB_INCLUDE }))!;
  const booked = job.offers.filter(o => o.status === "booked");
  // Their places on the production's crew go too
  const pcs = booked.map(o => o.productionCrewId).filter((x): x is number => x != null);
  if (pcs.length) await prisma.productionCrew.deleteMany({ where: { id: { in: pcs } } });
  await prisma.crewJob.delete({ where: { id: j.id } }); // its offers and hire charge go with it
  for (const o of booked) await tellCrew("released", o, job).catch(() => null);
  return NextResponse.json({ deleted: true, told: booked.length });
}
