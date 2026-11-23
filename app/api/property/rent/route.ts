import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { money } from "@/lib/parse";

const PROPERTY_ID = 1;

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const item = await prisma.propertyRent.upsert({
    where: { propertyId: PROPERTY_ID },
    create: {
      propertyId: PROPERTY_ID,
      amount: money(body.amount),
      frequency: body.frequency || null,
      nextPaymentDate: body.nextPaymentDate ? new Date(body.nextPaymentDate) : null,
      nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : null,
      landlordRef: body.landlordRef || null,
      notes: body.notes || null,
    },
    update: {
      amount: money(body.amount),
      frequency: body.frequency || null,
      nextPaymentDate: body.nextPaymentDate ? new Date(body.nextPaymentDate) : null,
      nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : null,
      landlordRef: body.landlordRef || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(item);
}
