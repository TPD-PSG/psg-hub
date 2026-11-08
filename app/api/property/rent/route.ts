import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PROPERTY_ID = 1;

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const item = await prisma.propertyRent.upsert({
    where: { propertyId: PROPERTY_ID },
    create: {
      propertyId: PROPERTY_ID,
      amount: body.amount ? Number(body.amount) : null,
      frequency: body.frequency || null,
      nextPaymentDate: body.nextPaymentDate ? new Date(body.nextPaymentDate) : null,
      nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : null,
      landlordRef: body.landlordRef || null,
      notes: body.notes || null,
    },
    update: {
      amount: body.amount ? Number(body.amount) : null,
      frequency: body.frequency || null,
      nextPaymentDate: body.nextPaymentDate ? new Date(body.nextPaymentDate) : null,
      nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : null,
      landlordRef: body.landlordRef || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(item);
}
