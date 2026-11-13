import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const production = await prisma.production.findUnique({
    where: { id: Number(id) },
    include: {
      events: { orderBy: { startAt: "asc" } },
      budgetLines: {
        orderBy: { department: "asc" },
        include: {
          expenses: {
            orderBy: { createdAt: "asc" },
            include: {
              documents: {
                select: { id: true, type: true, name: true, mime: true, invoiceDate: true, invoiceAmount: true, invoiceNumber: true, issuedForPayment: true, createdAt: true },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
      crew: {
        orderBy: { createdAt: "asc" },
        include: { crew: true },
      },
      hotelBookings: {
        orderBy: { checkIn: "asc" },
        include: { hotel: true, crew: true },
      },
      haulageMovements: {
        orderBy: { departureAt: "asc" },
      },
      productionDocuments: {
        select: { id: true, name: true, mime: true, folder: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      productionLinks: {
        orderBy: { createdAt: "asc" },
      },
      tourStops: {
        orderBy: { stopNumber: "asc" },
        include: { venue: { select: { id: true, name: true, city: true } } },
      },
      hsDocuments: {
        select: { id: true, name: true, mime: true, folder: true, tourStopId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      toolboxSignatures: {
        select: { id: true, tourStopId: true, venueName: true, signeeName: true, signeeDate: true, employer: true, position: true, agreedBriefing: true, agreedSafety: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      team: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      venueRef: { select: { id: true, name: true, city: true, capacity: true } },
    },
  });
  if (!production) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(production);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role ?? "member";
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const production = await prisma.production.update({
    where: { id: Number(id) },
    data: {
      name: body.name,
      type: body.type,
      venue: body.venue || null,
      venueId: body.venueId ? Number(body.venueId) : null,
      isTour: body.isTour ?? false,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      status: body.status,
      announcementStatus: body.announcementStatus || "not_announced",
      internalStatus: body.internalStatus || "pencil",
      productionManager: body.productionManager || null,
      color: body.color || null,
      notes: body.notes || null,
      reportEmail: body.reportEmail || null,
      sharepointUrl: body.sharepointUrl || null,
      haulageBudgetLineId: body.haulageBudgetLineId ? Number(body.haulageBudgetLineId) : null,
    },
  });
  return NextResponse.json(production);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role ?? "member";
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  if (typeof body.archived !== "boolean") return NextResponse.json({ error: "Missing archived field" }, { status: 400 });
  const production = await prisma.production.update({
    where: { id: Number(id) },
    data: { archived: body.archived, archivedAt: body.archived ? new Date() : null },
  });
  return NextResponse.json(production);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.production.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
