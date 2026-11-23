import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { loadProductionsForViewer } from "@/lib/productionList";

export async function GET(req: NextRequest) {
  const archived = new URL(req.url).searchParams.get("archived") === "1";
  return NextResponse.json(await loadProductionsForViewer({ archived }));
}

export async function POST(req: NextRequest) {
  // Creating productions is for PSG staff (it was open to anyone signed in)
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Only PSG staff can create productions" }, { status: 403 });
  const body = await req.json();
  const production = await prisma.production.create({
    data: {
      name: body.name,
      type: body.type,
      venue: body.venue || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      status: body.status || "planning",
      announcementStatus: body.announcementStatus || "not_announced",
      notes: body.notes || null,
    },
  });
  return NextResponse.json(production, { status: 201 });
}
