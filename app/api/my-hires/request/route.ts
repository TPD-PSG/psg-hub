// A client asks for a quote: their dates, collection or delivery, and kit from the rate card. It
// arrives as a quote marked "requested" for the team to price and send.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clientViewer } from "@/lib/clientPortal";
import { parseDay, text } from "@/lib/rentalAccess";
import { nextHireNumber } from "@/lib/rentals";
import { rentalCompanies, tellRentalStaff, clientHires } from "@/lib/rentalClients";

export async function POST(req: Request) {
  const v = await clientViewer();
  if ("error" in v) return v.error;
  const b = await req.json().catch(() => ({}));
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
  const companies = await rentalCompanies();
  const company = companies.find(c => c.id === Number(b.companyId)) ?? (companies.length === 1 ? companies[0] : null);
  if (!company) return bad("Choose who to ask");
  const title = text(b.title, 160);
  if (!title) return bad("Give your event or job a name");
  const outDate = parseDay(b.outDate), returnDate = parseDay(b.returnDate);
  if (!outDate || !returnDate) return bad("Give the dates you need the kit");
  if (returnDate < outDate) return bad("The kit can't come back before it goes out");
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (outDate < today) return bad("Pick dates from today on");
  if (b.delivery != null && b.delivery !== "" && b.delivery !== "collection" && b.delivery !== "delivery") return bad("Collection or delivery");
  const raw = Array.isArray(b.lines) ? b.lines : [];
  if (raw.length > 100) return bad("Up to 100 items");
  const lines = raw.map((l: Record<string, unknown>) => ({ productId: Number(l?.productId), quantity: Number(l?.quantity) })).filter((l: { productId: number; quantity: number }) => Number.isInteger(l.productId) && Number.isInteger(l.quantity) && l.quantity > 0 && l.quantity <= 1000);
  const notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim().slice(0, 2000) : null;
  if (!lines.length && !notes) return bad("Pick some kit from the rate card, or tell us what you need");
  const products = await prisma.rentalProduct.findMany({ where: { id: { in: lines.map((l: { productId: number }) => l.productId) }, entityId: company.id, archived: false }, select: { id: true, dayRate: true, weekRate: true } });
  if (products.length !== new Set(lines.map((l: { productId: number }) => l.productId)).size) return bad("Something picked isn't on the rate card");
  const email = (await auth())?.user?.email ?? null;
  const year = outDate.getUTCFullYear();
  const existing = (await prisma.rentalHire.findMany({ where: { number: { startsWith: `H-${year}-` } }, select: { number: true } })).map(h => h.number);
  const hire = await prisma.rentalHire.create({
    data: {
      entityId: company.id, number: nextHireNumber(year, existing), title, status: "quote", requestedAt: new Date(),
      clientId: v.clientId, clientName: v.clientName, clientEmail: email, outDate, returnDate,
      delivery: b.delivery || null, deliveryTo: b.delivery === "delivery" ? text(b.deliveryTo, 500) : null,
      // What they wrote goes in our notes (never on the PDF): we decide what's on the quote
      notes: [`Requested by ${v.name} (${v.clientName}) from their client login.`, notes].filter(Boolean).join("\n\n"),
      lines: { create: lines.map((l: { productId: number; quantity: number }, i: number) => { const p = products.find(x => x.id === l.productId)!; return { productId: l.productId, quantity: l.quantity, dayRate: p.dayRate, weekRate: p.weekRate, sortOrder: i }; }) },
    },
    select: { id: true, entityId: true, createdById: true, number: true },
  });
  await tellRentalStaff(hire, `Quote request from ${v.clientName}: ${title}`, `${hire.number} · ${outDate.toISOString().slice(0, 10)} to ${returnDate.toISOString().slice(0, 10)}`);
  return NextResponse.json({ number: hire.number, hires: await clientHires(v.clientId) }, { status: 201 });
}
