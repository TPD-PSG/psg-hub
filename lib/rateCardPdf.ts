// The hire rate card as a PDF (PSG Rentals & Crew): the company's letterhead, then the kit by
// category with day and week rates, ex VAT. No stock levels or costs.
import jsPDF from "jspdf";
import { autoTable, fetchLogoAsset, pdfSafe } from "@/lib/exports";
import { groupByCategory } from "@/lib/rentals";
import { spaceTokens } from "@/lib/spaceTheme";

export type RateCard = {
  company: { name: string; address: string | null; phone: string | null; brand: { color: string | null; logoUrl: string | null } | null };
  products: { id: number; name: string; category: string | null; manufacturer: string | null; model: string | null; dayRate: number | null; weekRate: number | null; weightKg: number | null; powerW: number | null }[];
};

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const money = (n: number | null) => (n == null ? "" : `£${new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`);

export function buildRateCardPDF(card: RateCard, logo?: { dataUrl: string; w: number; h: number } | null) {
  const doc = pdfSafe(new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }));
  const W = 210, M = 12, ink: Rgb = [25, 25, 28], soft: Rgb = [95, 98, 105];
  const t = spaceTokens(card.company.brand?.color ?? null);
  const rule = rgb(t["--tws-accent"]), tint = rgb(t["--tws-tint"]), accentInk = rgb(t["--tws-accent-ink"]);
  let x = M;
  if (logo) {
    const h = 20, w = Math.min(44, (logo.w / logo.h) * h), lh = w / (logo.w / logo.h);
    doc.setFillColor(245, 242, 236); doc.rect(M - 1.5, 10 - 1.5, w + 3, lh + 3, "F");
    doc.addImage(logo.dataUrl, "PNG", M, 10, w, lh, undefined, "FAST");
    x = M + w + 6;
  }
  doc.setTextColor(...ink); doc.setFontSize(9.5);
  const letter = [card.company.name, ...(card.company.address ?? "").split(/\r?\n/).map(l => l.trim()).filter(Boolean), card.company.phone ? `Phone: ${card.company.phone}` : ""].filter(Boolean);
  letter.forEach((l, i) => { doc.setFont("helvetica", i === 0 ? "bold" : "normal"); doc.text(l, x, 13 + i * 4.2); });
  doc.setFont("helvetica", "bold"); doc.setFontSize(21); doc.text("Hire Rate Card", W - M, 18, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }), W - M, 24, { align: "right" });
  const top = Math.max(13 + letter.length * 4.2, 30) + 2;
  doc.setFillColor(...rule); doc.rect(M, top, W - 2 * M, 1.2, "F");
  doc.setFontSize(9); doc.setTextColor(...soft);
  doc.text("Prices are per item, ex VAT. A week costs the week rate; days beyond a week cost the day rate, never more than another week.", M, top + 6);

  const body: unknown[][] = [];
  for (const g of groupByCategory(card.products)) {
    body.push([{ content: g.category, colSpan: 4, styles: { fontStyle: "bold", textColor: accentInk, fillColor: tint } }]);
    for (const p of g.items) body.push([p.name, [p.manufacturer, p.model].filter(Boolean).join(" "), { content: money(p.dayRate), styles: { halign: "right" } }, { content: money(p.weekRate), styles: { halign: "right" } }]);
  }
  autoTable(doc, {
    startY: top + 10, theme: "plain",
    head: [["Item", "Make and model", { content: "Day", styles: { halign: "right" } }, { content: "Week", styles: { halign: "right" } }]] as never,
    body: body as never,
    styles: { fontSize: 9, cellPadding: { top: 1.4, bottom: 1.4, left: 1.5, right: 1.5 }, textColor: ink },
    headStyles: { fontStyle: "bold", lineWidth: { bottom: 0.4 }, lineColor: [70, 72, 78] },
    columnStyles: { 2: { cellWidth: 26 }, 3: { cellWidth: 26 } },
    margin: { left: M, right: M, bottom: 16 },
  });
  const pages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...soft);
    doc.text(`${card.company.name} · Hire Rate Card`, M, 289);
    doc.text(`Page ${i} of ${pages}`, W - M, 289, { align: "right" });
  }
  return doc;
}

export async function downloadRateCardPDF(card: RateCard) {
  const logo = card.company.brand?.logoUrl ? await fetchLogoAsset(card.company.brand.logoUrl) : null;
  buildRateCardPDF(card, logo).save(`${card.company.name} rate card.pdf`.replace(/[\\/:*?"<>|]/g, "-"));
}
