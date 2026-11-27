import { NextRequest, NextResponse } from "next/server";
import { missing } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

const PROPERTY_ID = 1;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bad = missing(body, { name: "Give the document a name" });
  if (bad) return bad;
  const item = await prisma.propertyDocument.create({
    data: {
      propertyId: PROPERTY_ID,
      name: body.name,
      type: body.type || "other",
      expiryDate: (toDate(body.expiryDate) ?? null),
      fileUrl: body.fileUrl || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
