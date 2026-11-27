// Ask people from the crew directory if they're free for a job. Each gets their own link (emailed
// when they have an address); the links come back too, to send by text or WhatsApp.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jobAccess, JOB_INCLUDE, jobSummary, newToken, tellCrew } from "@/lib/crewOffers";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const j = await prisma.crewJob.findUnique({ where: { id: parseInt((await params).id) }, include: JOB_INCLUDE });
  if (!j) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = await jobAccess(j);
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const ids = Array.isArray(b.crewIds) ? [...new Set(b.crewIds.map(Number).filter(Number.isInteger))] as number[] : [];
  if (!ids.length) return NextResponse.json({ error: "Pick who to ask" }, { status: 400 });
  if (ids.length > 50) return NextResponse.json({ error: "Ask up to 50 people at a time" }, { status: 400 });
  const crew = await prisma.crew.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
  if (crew.length !== ids.length) return NextResponse.json({ error: "Someone picked isn't in the crew directory" }, { status: 400 });
  const already = new Set(j.offers.map(o => o.crewId));
  const fresh = crew.filter(c => !already.has(c.id));
  const sent: { crewId: number; name: string; link: string; emailed: string | null }[] = [];
  for (const c of fresh) {
    const offer = await prisma.crewOffer.create({ data: { jobId: j.id, crewId: c.id, token: newToken() } });
    const emailed = await tellCrew("offer", { token: offer.token, crew: c }, j);
    if (emailed) await prisma.crewOffer.update({ where: { id: offer.id }, data: { emailedTo: emailed } });
    sent.push({ crewId: c.id, name: c.name, link: `/crew-offer/${offer.token}`, emailed });
  }
  const job = (await prisma.crewJob.findUnique({ where: { id: j.id }, include: JOB_INCLUDE }))!;
  return NextResponse.json({ job: { ...job, summary: jobSummary(job) }, sent, skipped: crew.length - fresh.length }, { status: 201 });
}
