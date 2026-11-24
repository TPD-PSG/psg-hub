import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { clientData } from "@/lib/clients";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clients = await prisma.client.findMany({
    include: {
      contacts: true,
      targetOwner: { select: { id: true, name: true } },
      opportunities: { select: { id: true, stage: true } }, // to show open deals per client
      _count: { select: { opportunities: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(clients);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = clientData(await req.json());
  if (!data.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const client = await prisma.client.create({
    data: { type: "other", ...data, name: data.name as string },
    include: { contacts: true },
  });
  return NextResponse.json(client, { status: 201 });
}
