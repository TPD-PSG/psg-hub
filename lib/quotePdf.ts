// The client-facing quote PDF (portrait A4, PSG-branded). Shows what we charge, never our costs
// or internal notes.
import jsPDF from "jspdf";
import { autoTable, drawPsgLogo, fetchLogoAsset, pdfSafe, type LogoAsset } from "@/lib/exports";
import { quoteTotals } from "@/lib/quotes";
import { fmtDate } from "@/lib/format";

const NAVY: [number, number, number] = [10, 25, 65];
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

export type QuoteForPdf = {
  number: string; title: string; vatRate: number; validUntil: string | null; terms: string | null; createdAt: string; sentAt: string | null;
  entity: { name: string } | null;
  client: { name: string; billingName: string | null; billingAddress: string | null; address: string | null; billingEmail: string | null } | null;
  lines: { section: string | null; description: string; quantity: number; unit: string | null; unitCost: number; unitPrice: number }[];
};

export function buildQuotePDF(q: QuoteForPdf, logo?: LogoAsset): jsPDF {
  const doc = pdfSafe(new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }));
  const W = 210, M = 14;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 24, "F");
  let x = M;
  if (logo) {
    const h = 16, w = Math.min(36, (logo.w / logo.h) * h);
    drawPsgLogo(doc, logo, M, 4, w, (w / (logo.w / logo.h)));
    x = M + w + 5;
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(q.entity?.name ?? "Production Solutions Group", x, 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Quote ${q.number}`, W - M, 13, { align: "right" });

  // To / details
  doc.setTextColor(0, 0, 0);
  let y = 36;
  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(q.title, W - 2 * M - 60) as string[];
  doc.text(titleLines, M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 90, 100);
  const right = [
    `Quote ${q.number}`,
    `Date ${fmtDate(q.sentAt ?? q.createdAt)}`,
    q.validUntil ? `Valid until ${fmtDate(q.validUntil)}` : null,
  ].filter(Boolean) as string[];
  right.forEach((t, i) => doc.text(t, W - M, y - 4 + i * 4.5, { align: "right" }));
  y += Math.max(titleLines.length * 7, 12) + 2;
  if (q.client) {
    doc.setTextColor(90, 90, 100); doc.text("For", M, y);
    doc.setTextColor(0, 0, 0); doc.setFontSize(10);
    const to = [q.client.billingName ?? q.client.name, q.client.billingAddress ?? q.client.address, q.client.billingEmail].filter(Boolean).join("\n");
    const lines = doc.splitTextToSize(to, 90) as string[];
    doc.text(lines, M, y + 5);
    y += 5 + lines.length * 4.5 + 4;
  }

  // Lines, grouped by section in the order they first appear
  const sections: string[] = [];
  for (const l of q.lines) if (!sections.includes(l.section ?? "")) sections.push(l.section ?? "");
  const body: unknown[][] = [];
  for (const sec of sections) {
    const ls = q.lines.filter(l => (l.section ?? "") === sec);
    if (sec) body.push([{ content: sec, colSpan: 4, styles: { fontStyle: "bold", fillColor: [236, 239, 247], textColor: NAVY } }]);
    for (const l of ls) body.push([l.description, `${qty(l.quantity)}${l.unit ? ` ${l.unit}` : ""}`, { content: gbp(l.unitPrice), styles: { halign: "right" } }, { content: gbp(l.quantity * l.unitPrice), styles: { halign: "right" } }]);
  }
  const t = quoteTotals(q.lines, q.vatRate);
  const R = (s: string, bold = false) => ({ content: s, styles: { halign: "right" as const, fontStyle: bold ? "bold" as const : "normal" as const } });
  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", R("Rate"), R("Amount")]] as never,
    body: body as never,
    foot: [
      ["", "", R("Subtotal"), R(gbp(t.net))],
      ["", "", R(`VAT ${q.vatRate}%`), R(gbp(t.vat))],
      ["", "", R("Total", true), R(gbp(t.gross), true)],
    ] as never,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: NAVY },
    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
    columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 24 } },
    margin: { left: M, right: M },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (q.terms) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY);
    doc.text("Terms", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
    doc.text(doc.splitTextToSize(q.terms, W - 2 * M) as string[], M, y + 5);
  }
  // Footer: who it's from and the quote number on every page (not "Exported", it's a client document)
  const pages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(140, 140, 160);
    doc.text(`${q.entity?.name ?? "Production Solutions Group"} · Quote ${q.number}`, M, 290);
    doc.text(`Page ${i} of ${pages}`, W - M, 290, { align: "right" });
  }
  return doc;
}

export async function downloadQuotePDF(q: QuoteForPdf) {
  const logo = await fetchLogoAsset();
  buildQuotePDF(q, logo).save(`${q.number} ${q.title}.pdf`.replace(/[\\/:*?"<>|]/g, "-"));
}
