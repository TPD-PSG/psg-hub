// A hire as a PDF for the client (PSG Rentals & Crew): a Hire Quote while it's a quote, a Hire
// Confirmation once confirmed. The sales-quote layout in PSG's own letterhead (PSG logo, navy,
// PSG blue). Kit grouped by category, then other charges; discounts shown as their own lines.
// Never shows internal notes.
import { buildQuotePDF, PSG_SALES_BRAND, type QuoteForPdf } from "@/lib/quotePdf";
import { fetchLogoAsset } from "@/lib/exports";
import { hireTotals, type PricedLine } from "@/lib/rentals";
import { fmtDate } from "@/lib/format";

export type HireForPdf = {
  number: string; title: string; status: string; clientName: string | null; clientEmail: string | null;
  outDate: string; returnDate: string; chargeDays: number | null; discountPct: number | null; vatRate: number;
  paymentTerms: string | null; customerPo: string | null; delivery: string | null; deliveryTo: string | null;
  validUntil: string | null; terms: string | null; quoteSentAt: string | null; createdAt: string;
  createdBy: { name: string } | null; production: { name: string } | null;
  entity: QuoteForPdf["entity"];
  lines: (PricedLine & { note: string | null; product: { name: string; category: string | null } })[];
  charges: { description: string; quantity: number; unitPrice: number }[];
};

export function hireToQuote(h: HireForPdf): QuoteForPdf {
  const t = hireTotals(h);
  const daysLabel = `${t.days} day${t.days === 1 ? "" : "s"}`;
  const lines: QuoteForPdf["lines"] = [];
  h.lines.forEach((l, i) => {
    const p = t.priced[i];
    lines.push({ section: l.product.category || "Kit", description: `${l.product.name}${l.note ? ` (${l.note})` : ""} · ${daysLabel}`, quantity: l.quantity, unit: "each", unitCost: 0, unitPrice: p.each, kind: "kit" });
    if (p.off) lines.push({ section: l.product.category || "Kit", description: `Discount on ${l.product.name} (${l.discountPct}%)`, quantity: 1, unit: "each", unitCost: 0, unitPrice: -p.off, kind: "discount" });
  });
  // The hire's discount sits on its own after the kit (no heading of its own)
  if (t.hireDiscount) lines.push({ section: null, description: `Hire discount: ${h.discountPct}% off the kit`, quantity: 1, unit: "each", unitCost: 0, unitPrice: -t.hireDiscount, kind: "discount" });
  for (const c of h.charges) {
    const transport = /transport|deliver|collect|van|truck/i.test(c.description);
    lines.push({ section: transport ? "Transport" : "Other charges", description: c.description, quantity: c.quantity, unit: "each", unitCost: 0, unitPrice: c.unitPrice, kind: transport ? "transport" : "charge" });
  }
  const confirmed = !["quote", "cancelled"].includes(h.status);
  return {
    kind: confirmed ? "Hire Confirmation" : "Hire Quote",
    number: h.number, title: h.title, vatRate: h.vatRate,
    validUntil: confirmed ? null : h.validUntil, terms: h.terms, createdAt: h.createdAt, sentAt: h.quoteSentAt,
    extraLines: [`Kit out ${fmtDate(h.outDate)}, back ${fmtDate(h.returnDate)}: ${daysLabel} charged${h.production ? ` · for ${h.production.name}` : ""}`],
    entity: h.entity,
    customerPo: h.customerPo, paymentTerms: h.paymentTerms, dueDate: null, // the hire's dates are in the line under the totals
    shippingMethod: h.delivery === "delivery" ? "Delivered by us" : h.delivery === "collection" ? "Client collection" : null,
    shipTo: h.delivery === "delivery" ? h.deliveryTo : h.delivery === "collection" ? `Collect from ${h.entity?.name ?? "our warehouse"}` : null,
    createdBy: h.createdBy,
    client: h.clientName ? { name: h.clientName, billingName: null, billingAddress: null, address: null, billingEmail: h.clientEmail } : null,
    lines,
  };
}

export async function hirePdfUrl(h: HireForPdf) {
  const q = hireToQuote(h), brand = PSG_SALES_BRAND; // PSG Rentals & Crew is part of PSG: PSG's letterhead
  const logo = await fetchLogoAsset(brand.logoUrl ?? undefined);
  return URL.createObjectURL(buildQuotePDF(q, logo, brand).output("blob"));
}
export async function downloadHirePDF(h: HireForPdf) {
  const q = hireToQuote(h), brand = PSG_SALES_BRAND; // PSG Rentals & Crew is part of PSG: PSG's letterhead
  const logo = await fetchLogoAsset(brand.logoUrl ?? undefined);
  buildQuotePDF(q, logo, brand).save(`${h.number} ${h.title}.pdf`.replace(/[\\/:*?"<>|]/g, "-"));
}
