// Change a stock level: book out to a job, return from a job, or a stock count.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePoUser } from "@/lib/purchaseOrders";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requirePoUser();
  if ("error" in u) return u.error;
  const item = await prisma.stockItem.findUnique({ where: { id: parseInt((await params).id) } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const kind = body.kind;
  if (!["book_out", "return", "count"].includes(kind)) return NextResponse.json({ error: "Book out, return or count" }, { status: 400 });
  const q = Number(body.quantity);
  if (!isFinite(q) || q < 0 || (kind !== "count" && q === 0)) return NextResponse.json({ error: "Enter a quantity" }, { status: 400 });
  let jobId: number | null = null;
  if (body.jobId != null && body.jobId !== "") {
    jobId = Number(body.jobId);
    if (!(await prisma.job.count({ where: { id: jobId, entityId: item.entityId } }))) return NextResponse.json({ error: "Pick one of this company's jobs" }, { status: 400 });
  }
  if (kind === "book_out" && !jobId) return NextResponse.json({ error: "Pick the job it's for" }, { status: 400 });
  if (kind === "book_out" && q > item.quantity) return NextResponse.json({ error: `Only ${item.quantity} ${item.unit} in stock` }, { status: 400 });
  const change = kind === "book_out" ? -q : kind === "return" ? q : q - item.quantity;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 200) : null;
  const [move, updated] = await prisma.$transaction([
    prisma.stockMove.create({ data: { itemId: item.id, change, kind: kind === "count" ? "adjust" : kind, jobId, unitCost: item.unitCost, note: note ?? (kind === "count" ? "Stock count" : null), userId: u.userId } }),
    prisma.stockItem.update({ where: { id: item.id }, data: { quantity: { increment: change } } }),
  ]);
  return NextResponse.json({ move, item: updated }, { status: 201 });
}
