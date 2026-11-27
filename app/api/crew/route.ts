import { myCompanyLimit, productionWhere } from "@/lib/companyScope";
import { NextRequest, NextResponse } from "next/server";
import { missing } from "@/lib/required";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toDate } from "@/lib/parse"; // a bad date counts as blank, not a server error (audit round 2)

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const crew = await prisma.crew.findMany({
    orderBy: { name: "asc" },
    include: { productions: { where: productionWhere(await myCompanyLimit()), include: { production: true } } }, // only bookings on shows of companies they can see
  });
  return NextResponse.json(crew);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bad = missing(body, { name: "Add their name", discipline: "Pick their department" });
  if (bad) return bad;
  const member = await prisma.crew.create({
    data: {
      name:                body.name,
      discipline:          body.discipline,
      phone:               body.phone || null,
      email:               body.email || null,
      company:             body.company || null,
      isFreelance:         body.isFreelance ?? true,
      insuranceProvider:   body.insuranceProvider || null,
      insurancePolicyNo:   body.insurancePolicyNo || null,
      insuranceExpiry:     (toDate(body.insuranceExpiry) ?? null),
      insuranceCoverType:  body.insuranceCoverType || null,
      notes:               body.notes || null,
    },
  });
  return NextResponse.json(member, { status: 201 });
}
