import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PROPERTY_ID = 1;

export async function GET() {
  const property = await prisma.property.findUnique({
    where: { id: PROPERTY_ID },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { expiryDate: "asc" } },
      maintenance: { orderBy: { createdAt: "desc" } },
      rent: true,
      keys: { orderBy: { createdAt: "asc" } },
      alarms: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!property) {
    // Auto-create the property record on first access
    const created = await prisma.property.create({
      data: { id: PROPERTY_ID, name: "Cockshute Industrial Estate" },
      include: {
        contacts: true,
        documents: true,
        maintenance: true,
        rent: true,
        keys: true,
        alarms: true,
      },
    });
    return NextResponse.json(created);
  }
  return NextResponse.json(property);
}
