// A purchase order for the supplier (portrait A4), in the company space's look: logo on a paper
// panel, night-dark header with its accent rule. Prices ex VAT. A draft or one awaiting approval
// is marked "not for ordering" so it can't be sent by mistake.
import jsPDF from "jspdf";
import { autoTable, fetchLogoAsset, pdfSafe, type LogoAsset } from "@/lib/exports";
import { spaceTokens } from "@/lib/spaceTheme";
import { fmtDate } from "@/lib/format";
import { PO_STATUS } from "@/lib/poStatus";

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, ""));

export type PoForPdf = {
  number: string; status: string; notes: string | null; createdAt: string; approvedAt: string | null; orderedAt: string | null;
  supplierName: string | null; supplier: { name: string; email: string | null; phone: string | null } | null;
  job: { number: string; title: string } | null; raisedBy: { name: string } | null; approvedBy: { name: string } | null;
  lines: { description: string; quantity: number; unit: string | null; unitCost: number }[];
};
export type PoCompany = { name: string; color: string | null; logoUrl: string | null };

export function buildPoPDF(po: PoForPdf, company: PoCompany, logo?: LogoAsset): jsPDF {
  const t = spaceTokens(company.color);
  const night = rgb(t["--tws-night"]), accent = rgb(t["--tws-accent"]), ink = rgb(t["--tws-accent-ink"]), tint = rgb(t["--tws-tint"]);
  const doc = pdfSafe(new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }));
  const W = 210, M = 14;
  doc.setFillColor(...night); doc.rect(0, 0, W, 24, "F");
  doc.setFillColor(...accent); doc.rect(0, 24, W, 1.4, "F");
  let x = M;
  if (logo) {
    const h = 16, w = Math.min(36, (logo.w / logo.h) * h), lh = w / (logo.w / logo.h);
    doc.setFillColor(245, 242, 236); doc.rect(M - 1.5, 4 - 1.5, w + 3, lh + 3, "F");
    doc.addImage(logo.dataUrl, "PNG", M, 4, w, lh, undefined, "FAST");
    x = M + w + 5;
  }
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(company.name, x, 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Purchase order ${po.number}`, W - M, 13, { align: "right" });

  let y = 38;
  const notForOrdering = po.status === "draft" || po.status === "awaiting_approval" || po.status === "cancelled";
  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text("Purchase order", M, y);
  if (notForOrdering) {
    doc.setTextColor(163, 54, 31); doc.setFontSize(11);
    doc.text(`${(PO_STATUS[po.status] ?? po.status).toUpperCase()}: NOT FOR ORDERING`, W - M, y, { align: "right" });
  }
  y += 8;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 90, 100);
  const meta = [
    `PO number  ${po.number}`,
    `Date  ${fmtDate(po.orderedAt ?? po.approvedAt ?? po.createdAt)}`,
    po.job ? `Job  ${po.job.number} · ${po.job.title}` : null,
    po.approvedAt ? `Approved  ${fmtDate(po.approvedAt)}${po.approvedBy ? ` by ${po.approvedBy.name}` : ""}` : null,
    po.raisedBy ? `Raised by  ${po.raisedBy.name}` : null,
  ].filter(Boolean) as string[];
  meta.forEach((m, i) => doc.text(m, W - M, y + i * 4.5, { align: "right" }));
  doc.text("Supplier", M, y);
  doc.setTextColor(0, 0, 0); doc.setFontSize(10);
  const sup = [po.supplier?.name ?? po.supplierName ?? "Supplier not set", po.supplier?.email, po.supplier?.phone].filter(Boolean).join("\n");
  const supLines = doc.splitTextToSize(sup, 90) as string[];
  doc.text(supLines, M, y + 5);
  y += Math.max(meta.length * 4.5, 5 + supLines.length * 4.5) + 8;

  const total = po.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const R = (s: string, bold = false) => ({ content: s, styles: { halign: "right" as const, fontStyle: bold ? "bold" as const : "normal" as const } });
  autoTable(doc, {
    startY: y,
    head: [["Item", "Qty", R("Price each"), R("Amount")]] as never,
    body: po.lines.map(l => [l.description, `${qty(l.quantity)}${l.unit ? ` ${l.unit}` : ""}`, R(gbp(l.unitCost)), R(gbp(l.quantity * l.unitCost))]) as never,
    foot: [["", "", R("Total (ex VAT)", true), R(gbp(total), true)]] as never,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: night },
    footStyles: { fillColor: tint, textColor: [0, 0, 0] },
    columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 26 } },
    margin: { left: M, right: M },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (po.notes) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...ink);
    doc.text("Notes and delivery", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
    doc.text(doc.splitTextToSize(po.notes, W - 2 * M) as string[], M, y + 5);
  }
  const pages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(140, 140, 160);
    doc.text(`${company.name} · Purchase order ${po.number} · Please quote our PO number on your invoice`, M, 290);
    doc.text(`Page ${i} of ${pages}`, W - M, 290, { align: "right" });
  }
  return doc;
}

export async function downloadPoPDF(po: PoForPdf, company: PoCompany) {
  const logo = company.logoUrl ? await fetchLogoAsset(company.logoUrl) : null;
  buildPoPDF(po, company, logo ?? undefined).save(`${po.number} ${po.supplier?.name ?? po.supplierName ?? ""}.pdf`.replace(/[\\/:*?"<>|]/g, "-").trim());
}
