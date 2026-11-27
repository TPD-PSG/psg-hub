// Raise the sales invoice for a hire in Finance (or bring a draft one up to date with the hire).
// Amounts come from the hire's totals; once the invoice has been sent it's left alone.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffForEntity, notFound, bad } from "@/lib/rentalAccess";
import { HIRE_INCLUDE, hireOut } from "@/lib/rentalHires";
import { hireTotals, invoiceDue } from "@/lib/rentals";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseInt((await params).id);
  const hire = await prisma.rentalHire.findUnique({ where: { id }, include: HIRE_INCLUDE });
  if (!hire) return notFound();
  const a = await staffForEntity(hire.entityId);
  if ("error" in a) return a.error;
  if (!["confirmed", "out", "returned"].includes(hire.status)) return bad("Confirm the hire before invoicing it");
  if (!hire.clientName) return bad("Add the client's name first");
  const t = hireTotals(hire);
  if (t.net <= 0) return bad("There's nothing to invoice: the hire comes to £0");
  const details = {
    netAmount: t.net, vatAmount: t.vat, party: hire.clientName,
    description: `Hire ${hire.number}: ${hire.title}`,
    production: hire.production?.name ?? null,
    notes: [`${hire.entity.name} · out ${hire.outDate.toISOString().slice(0, 10)}, back ${hire.returnDate.toISOString().slice(0, 10)} · ${t.days} day${t.days === 1 ? "" : "s"} charged`, hire.customerPo ? `Customer PO ${hire.customerPo}` : null].filter(Boolean).join("\n"),
  };
  if (hire.invoice) {
    if (hire.invoice.status !== "draft") return bad(`The invoice has been ${hire.invoice.status === "paid" ? "paid" : "sent"}, so it isn't changed. Change it in Finance if you need to.`, 409);
    await prisma.companyInvoice.update({ where: { id: hire.invoice.id }, data: details });
  } else {
    const issued = new Date(); issued.setUTCHours(0, 0, 0, 0);
    const inv = await prisma.companyInvoice.create({ data: { type: "sales", reference: hire.number, status: "draft", issueDate: issued, dueDate: invoiceDue(hire.paymentTerms, issued, hire.outDate), ...details } });
    await prisma.rentalHire.update({ where: { id: hire.id }, data: { invoiceId: inv.id } });
  }
  return NextResponse.json(await hireOut((await prisma.rentalHire.findUnique({ where: { id }, include: HIRE_INCLUDE }))!), { status: hire.invoice ? 200 : 201 });
}
