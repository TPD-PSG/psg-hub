// A client accepts a quote they've been sent. The team is told and confirms it (the kit check
// runs on our side), so accepting doesn't book anything by itself.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientViewer } from "@/lib/clientPortal";
import { tellRentalStaff, clientHires } from "@/lib/rentalClients";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await clientViewer();
  if ("error" in v) return v.error;
  const id = parseInt((await params).id);
  const mine = (await clientHires(v.clientId)).find(h => h.id === id);
  if (!mine) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!mine.canAccept) return NextResponse.json({ error: mine.acceptedAt ? "You've already accepted this quote" : mine.status !== "quote" ? "This hire is already confirmed" : "This quote can't be accepted now (it may have run out). Ask us for an up-to-date one." }, { status: 409 });
  const h = await prisma.rentalHire.update({ where: { id }, data: { acceptedAt: new Date(), acceptedBy: `${v.name} (${v.clientName})` }, select: { id: true, entityId: true, createdById: true, number: true, title: true } });
  await tellRentalStaff(h, `${v.clientName} accepted ${h.number}: confirm it`, `${h.title}, accepted by ${v.name}`);
  return NextResponse.json({ hires: await clientHires(v.clientId) });
}
