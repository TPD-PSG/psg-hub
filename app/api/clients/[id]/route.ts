import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccess, parsePerms } from "@/lib/permissions";
import { clientData, sameParty } from "@/lib/clients";
import { shapeOpportunity, OPPORTUNITY_INCLUDE } from "@/lib/opportunities";

// Everything about one client: contacts, deals, productions, and (with finance access) sales
// invoices matched by name. PM fees only for PSG staff.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { role?: string; permissions?: string | null };
  const role = user.role ?? "member";
  const staff = role === "admin" || role === "member";
  const id = parseInt((await params).id);
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { name: "asc" } },
      targetOwner: { select: { id: true, name: true } },
      opportunities: { include: OPPORTUNITY_INCLUDE, orderBy: { updatedAt: "desc" } },
      productions: {
        select: { id: true, name: true, status: true, startDate: true, endDate: true, archived: true, pmFee: staff, entity: { select: { name: true } } },
        orderBy: { startDate: "desc" },
      },
    },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let invoices = null;
  if (canAccess(parsePerms(user.permissions), "finance", role)) {
    const sales = await prisma.companyInvoice.findMany({ where: { type: "sales" }, orderBy: { issueDate: "desc" } });
    invoices = sales.filter(i => sameParty(i.party, [client.name, client.billingName]));
  }
  return NextResponse.json({ ...client, opportunities: client.opportunities.map(shapeOpportunity), invoices });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const client = await prisma.client.update({
    where: { id: parseInt(id) },
    data: clientData(await req.json()),
    include: { contacts: true, targetOwner: { select: { id: true, name: true } } },
  }).catch(() => null);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(client);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.client.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
