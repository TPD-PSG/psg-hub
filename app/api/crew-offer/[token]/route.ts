// The crew member's private link (no login): see the job and say whether they're free.
// Shows their pay, never what the client is charged.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { offerForCrew } from "@/lib/crewOfferPublic";

const load = (token: string) => (/^[A-Za-z0-9_-]{20,64}$/.test(token) ? prisma.crewOffer.findUnique({ where: { token }, include: { crew: { select: { name: true } }, job: { include: { hire: { select: { id: true, title: true, entity: { select: { name: true, phone: true, slug: true } } } }, production: { select: { name: true } }, offers: { select: { status: true } } } } } }) : null);

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const o = await load((await params).token);
  if (!o) return NextResponse.json({ error: "This link isn't right, or the offer has been withdrawn" }, { status: 404 });
  return NextResponse.json(offerForCrew(o));
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const o = await load((await params).token);
  if (!o) return NextResponse.json({ error: "This link isn't right, or the offer has been withdrawn" }, { status: 404 });
  const view = offerForCrew(o);
  if (!view.canAnswer) return NextResponse.json({ error: view.message }, { status: 409 });
  const b = await req.json().catch(() => ({}));
  if (b.answer !== "available" && b.answer !== "unavailable") return NextResponse.json({ error: "Say yes or no" }, { status: 400 });
  const reply = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 500) : null;
  await prisma.crewOffer.update({ where: { id: o.id }, data: { status: b.answer, reply, respondedAt: new Date() } });
  // Let whoever set the job up know
  if (o.job.createdById) await prisma.notification.create({ data: { userId: o.job.createdById, title: `${o.crew.name} ${b.answer === "available" ? "is available" : "can't do it"}: ${o.job.role}`, body: reply, link: o.job.hire ? `/spaces/${o.job.hire.entity.slug}/hires?hire=${o.job.hire.id}` : `/productions/${o.job.productionId}?section=crew` } }).catch(() => null);
  return NextResponse.json(offerForCrew((await load(o.token))!));
}
