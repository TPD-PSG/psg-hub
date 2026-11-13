import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { parsePerms } from "@/lib/permissions";

const include = {
  _count: { select: { events: true, budgetLines: true, crew: true } },
  budgetLines: { include: { expenses: true } },
  events: { orderBy: { startAt: "asc" as const } },
  team: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }, orderBy: { createdAt: "asc" as const } },
  venueRef: { select: { name: true, city: true } },
};

export async function GET(req: NextRequest) {
  const session = await auth();
  const role: string = (session?.user as any)?.role ?? "member";
  const userId: number | undefined = (session?.user as any)?.id ? Number((session!.user as any).id) : undefined;
  const permsRaw: string | null = (session?.user as any)?.permissions ?? null;
  const perms = parsePerms(permsRaw);

  const { searchParams } = new URL(req.url);
  const showArchived = searchParams.get("archived") === "1";

  const where: Record<string, unknown> = { archived: showArchived };
  if (role !== "admin" && !perms.allProductions && userId) {
    where.team = { some: { userId } };
  }

  const productions = await prisma.production.findMany({
    where,
    orderBy: showArchived ? { archivedAt: "desc" } : { createdAt: "desc" },
    include,
  });
  return NextResponse.json(productions);
}

export async function POST(req: NextRequest) {
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
