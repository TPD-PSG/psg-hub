import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clients = await prisma.client.findMany({
    include: { contacts: true, _count: { select: { opportunities: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(clients);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();
  const client = await prisma.client.create({
    data: {
      name: data.name,
      type: data.type,
      website: data.website || null,
      address: data.address || null,
      notes: data.notes || null,
    },
    include: { contacts: true },
  });
  return NextResponse.json(client, { status: 201 });
}
