// The team's side of one offer: book them, release them, note their answer (taken by phone),
// ask again, or withdraw an offer nobody's booked on.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jobAccess, JOB_INCLUDE, jobSummary, syncHireCharge, syncProductionCrew, tellCrew } from "@/lib/crewOffers";

const load = (id: number) => prisma.crewOffer.findUnique({ where: { id }, include: { crew: { select: { name: true, email: true } }, job: { include: JOB_INCLUDE } } });
const out = async (jobId: number) => { const job = (await prisma.crewJob.findUnique({ where: { id: jobId }, include: JOB_INCLUDE }))!; return { ...job, summary: jobSummary(job) }; };

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = await load(parseInt((await params).id));
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = await jobAccess(o.job);
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
  switch (b.action) {
    case "book": {
      if (o.status === "booked") return bad(`${o.crew.name} is already booked`);
      if (o.status === "unavailable") return bad(`${o.crew.name} said they can't do it. Note their new answer first if they've changed their mind.`, 409);
      const booked = o.job.offers.filter(x => x.status === "booked").length;
      if (booked >= o.job.places) return bad(`All ${o.job.places} place${o.job.places === 1 ? " is" : "s are"} booked. Add a place to book another.`, 409);
      await prisma.crewOffer.update({ where: { id: o.id }, data: { status: "booked", bookedAt: new Date(), bookedById: a.userId } });
      await syncProductionCrew(o.id); await syncHireCharge(o.jobId);
      if (b.tell !== false) await tellCrew("booked", o, o.job).catch(() => null);
      break;
    }
    case "release": {
      if (o.status !== "booked") return bad(`${o.crew.name} isn't booked`);
      await prisma.crewOffer.update({ where: { id: o.id }, data: { status: "released", bookedAt: null, bookedById: null } });
      await syncProductionCrew(o.id); await syncHireCharge(o.jobId);
      if (b.tell !== false) await tellCrew("released", o, o.job).catch(() => null);
      break;
    }
    case "answer": { // their answer, taken some other way (a call, a text)
      if (o.status === "booked") return bad("Release them first");
      if (b.status !== "available" && b.status !== "unavailable") return bad("Their answer is available or unavailable");
      await prisma.crewOffer.update({ where: { id: o.id }, data: { status: b.status, respondedAt: new Date(), reply: typeof b.reply === "string" && b.reply.trim() ? b.reply.trim().slice(0, 500) : o.reply } });
      break;
    }
    case "resend": {
      if (o.status === "booked") return bad("They're booked already");
      const emailed = await tellCrew("offer", o, o.job);
      await prisma.crewOffer.update({ where: { id: o.id }, data: { sentAt: new Date(), ...(emailed ? { emailedTo: emailed } : {}), ...(o.status === "released" ? { status: "offered" } : {}) } });
      break;
    }
    default: return bad("Book, release, answer or resend");
  }
  return NextResponse.json(await out(o.jobId));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = await load(parseInt((await params).id));
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = await jobAccess(o.job);
  if ("error" in a) return a.error;
  if (o.status === "booked") return NextResponse.json({ error: "Release them before withdrawing the offer" }, { status: 400 });
  await prisma.crewOffer.delete({ where: { id: o.id } });
  return NextResponse.json(await out(o.jobId));
}
