import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// POST — admin triggers the monthly roundup
export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role ?? "member";
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const monthYear: string = body.monthYear; // e.g. "2026-11"

  // Check there are pending submissions for this month
  const pending = await prisma.funSubmission.findMany({
    where: { monthYear, roundupId: null },
  });
  if (pending.length === 0) {
    return NextResponse.json({ error: "No pending submissions for this month" }, { status: 400 });
  }

  // Create (or find) the roundup record
  let roundup = await prisma.funRoundup.findUnique({ where: { monthYear } });
  if (!roundup) {
    roundup = await prisma.funRoundup.create({ data: { monthYear, sentAt: new Date() } });
  }

  // Link all pending submissions to it
  await prisma.funSubmission.updateMany({
    where: { monthYear, roundupId: null },
    data: { roundupId: roundup.id },
  });

  // Notify all users
  const users = await prisma.user.findMany({ select: { id: true } });
  const [y, m] = monthYear.split("-");
  const label = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
  await prisma.notification.createMany({
    data: users.map(u => ({
      userId: u.id,
      title: `🎉 Fun Roundup — ${label}`,
      body: `The ${label} roundup is here! ${pending.length} ${pending.length === 1 ? "story" : "stories"} inside.`,
      link: "/fun",
    })),
  });

  return NextResponse.json({ ok: true, count: pending.length, roundupId: roundup.id });
}
