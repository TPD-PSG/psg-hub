import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.spendDocument.findUnique({ where: { id: Number(id) } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buffer = Buffer.from(doc.file, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `attachment; filename="${doc.name}"`,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const doc = await prisma.spendDocument.update({
    where: { id: Number(id) },
    data: {
      invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : null,
      invoiceAmount: body.invoiceAmount != null ? Number(body.invoiceAmount) : null,
      invoiceNumber: body.invoiceNumber !== undefined ? (body.invoiceNumber || null) : undefined,
      issuedForPayment: body.issuedForPayment ?? false,
    },
    select: { id: true, type: true, name: true, mime: true, invoiceDate: true, invoiceAmount: true, invoiceNumber: true, issuedForPayment: true, createdAt: true },
  });
  return NextResponse.json(doc);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "admin" && role !== "member") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.spendDocument.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
