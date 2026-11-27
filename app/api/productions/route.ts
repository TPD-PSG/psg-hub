import { companyLimit, scopedEntityId } from "@/lib/companyScope";
import { NextRequest, NextResponse } from "next/server";
import { missing } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { loadProductionsForViewer } from "@/lib/productionList";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export async function GET(req: NextRequest) {
  const archived = new URL(req.url).searchParams.get("archived") === "1";
  return NextResponse.json(await loadProductionsForViewer({ archived }));
}

export async function POST(req: NextRequest) {
  // Creating productions is for PSG staff (it was open to anyone signed in)
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Only PSG staff can create productions" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const bad = missing(body, { name: "Give the production a name" });
  if (bad) return bad;
  // Someone limited to certain companies creates productions within them (else they'd lose sight of it)
  const limit = role === "admin" ? null : await companyLimit(Number((session?.user as { id?: string } | undefined)?.id));
  const ent = scopedEntityId(limit, body.entityId ? Number(body.entityId) : null);
  if ("error" in ent) return NextResponse.json({ error: ent.error }, { status: 400 });
  const production = await prisma.production.create({
    data: {
      ...(ent.entityId != null ? { entityId: ent.entityId } : {}),
      name: body.name,
      type: body.type,
      venue: body.venue || null,
      startDate: (toDate(body.startDate) ?? null),
      endDate: (toDate(body.endDate) ?? null),
      status: body.status || "planning",
      announcementStatus: body.announcementStatus || "not_announced",
      notes: body.notes || null,
    },
  });
  return NextResponse.json(production, { status: 201 });
}
