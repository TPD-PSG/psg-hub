import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const PROPERTY_ID = 1;

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = (session.user as { role?: string } | undefined)?.role === "admin";

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
    return NextResponse.json(forViewer(created, isAdmin));
  }
  return NextResponse.json(forViewer(property, isAdmin));
}

// Alarm codes are for admins only (Toby, 28 Nov 2026): everyone else sees the alarm records
// (name, zones, monitoring company, keyholders) without the code, and can't change them
function forViewer<T extends { alarms: { code: string | null }[] }>(p: T, isAdmin: boolean) {
  return { ...p, alarmAdmin: isAdmin, alarms: isAdmin ? p.alarms : p.alarms.map(a => ({ ...a, code: null, codeHidden: !!a.code })) };
}
