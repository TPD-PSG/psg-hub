import { myCompanyLimit, productionWhere, optionalProductionWhere } from "@/lib/companyScope";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await myCompanyLimit(); // companies they can see
  const [psgExpenses, rechargeableMovements, productionExpenses] = await Promise.all([
    prisma.expense.findMany({
      where: { isPSGExpense: true, ...(limit ? { budgetLine: productionWhere(limit) } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        budgetLine: {
          select: {
            id: true,
            department: true,
            description: true,
            nominalCode: true,
            production: { select: { id: true, name: true } },
          },
        },
        documents: {
          select: { id: true, type: true, name: true, invoiceDate: true, invoiceAmount: true, invoiceNumber: true, issuedForPayment: true },
        },
      },
    }),
    prisma.haulageMovement.findMany({
      where: { rechargeable: true, ...productionWhere(limit) },
      orderBy: { departureAt: "desc" },
      include: {
        production: { select: { id: true, name: true } },
      },
    }),
    prisma.productionExpense.findMany({
      where: { productionId: { not: null }, ...(limit ? { productionLink: { entityId: { in: limit } } } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        productionLink: { select: { id: true, name: true } },
        submittedByUser: { select: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({ psgExpenses, rechargeableMovements, productionExpenses });
}
