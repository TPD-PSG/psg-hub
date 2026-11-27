// Crew offers for the signed-in person (matched by their email to the crew directory).
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const crew = await prisma.crew.findMany({ where: { email: { not: null } }, select: { id: true, email: true } });
  const ids = crew.filter(c => c.email!.trim().toLowerCase() === email).map(c => c.id);
  const offers = ids.length ? await prisma.crewOffer.findMany({
    where: { crewId: { in: ids }, job: { date: { gte: today } } },
    select: { token: true, status: true, job: { select: { role: true, date: true, callTime: true, hire: { select: { title: true } }, production: { select: { name: true } } } } },
    orderBy: { job: { date: "asc" } },
  }) : [];
  return NextResponse.json({ offers: offers.map(o => ({ link: `/crew-offer/${o.token}`, status: o.status, role: o.job.role, date: o.job.date, callTime: o.job.callTime, for: o.job.hire?.title ?? o.job.production?.name ?? null })) });
}
