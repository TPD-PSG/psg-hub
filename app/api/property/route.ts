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
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(property);
}
