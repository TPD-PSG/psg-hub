// The client-facing quote PDF (portrait A4). PSG-branded, or in a company's own look when that
// company has its own space (e.g. The Workshop Stoke: its logo, night-dark header, brass rule).
// Shows what we charge, never our costs or internal notes.
import jsPDF from "jspdf";
import { autoTable, drawPsgLogo, fetchLogoAsset, pdfSafe, type LogoAsset } from "@/lib/exports";
import { quoteTotals } from "@/lib/quotes";
import { fmtDate } from "@/lib/format";
import { spaceTokens } from "@/lib/spaceTheme";

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
export type Brand = { header: Rgb; rule: Rgb | null; tint: Rgb; accentInk: Rgb; logoUrl: string | null };
const PSG_BRAND: Brand = { header: [10, 25, 65], rule: null, tint: [236, 239, 247], accentInk: [10, 25, 65], logoUrl: null };

/** The look for a quote's company: its space colours and logo, else PSG's. */
export function brandFor(entity: QuoteForPdf["entity"]): Brand {
  if (!entity?.hasSpace || !entity.slug) return PSG_BRAND;
  const t = spaceTokens(entity.color ?? null);
  const v = entity.updatedAt ? new Date(entity.updatedAt).getTime() : 0;
  return {
    header: rgb(t["--tws-night"]), rule: rgb(t["--tws-accent"]), tint: rgb(t["--tws-tint"]), accentInk: rgb(t["--tws-accent-ink"]),
    logoUrl: entity.logoMime ? `/api/spaces/${entity.slug}/logo?v=${v}` : null,
  };
}

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

export type QuoteForPdf = {
  number: string; title: string; vatRate: number; showSubtotals?: boolean;
  pdfDetail?: string; // "items": one price per section (the client sees what each item costs, not how)
  kind?: string; // what the document is called (default "Quote"; a variation says "Variation")
  extraLines?: string[]; // small lines under the dates, e.g. "Approved by …"
  validUntil: string | null; terms: string | null; createdAt: string; sentAt: string | null;
  entity: { name: string; hasSpace?: boolean; slug?: string | null; color?: string | null; logoMime?: string | null; updatedAt?: string | Date } | null;
  client: { name: string; billingName: string | null; billingAddress: string | null; address: string | null; billingEmail: string | null } | null;
  lines: { section: string | null; description: string; quantity: number; unit: string | null; unitCost: number; unitPrice: number }[];
};

export function buildQuotePDF(q: QuoteForPdf, logo?: LogoAsset, brand: Brand = brandFor(q.entity)): jsPDF {
  const doc = pdfSafe(new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }));
  const W = 210, M = 14;
  doc.setFillColor(...brand.header);
  doc.rect(0, 0, W, 24, "F");
  if (brand.rule) { doc.setFillColor(...brand.rule); doc.rect(0, 24, W, 1.4, "F"); }
  let x = M;
  if (logo) {
    const h = 16, w = Math.min(36, (logo.w / logo.h) * h);
    const lh = w / (logo.w / logo.h);
    if (brand.rule) {
      // A space's logo sits on its paper ground (TWS's logo has a white T that would vanish on white)
      doc.setFillColor(245, 242, 236);
      doc.rect(M - 1.5, 4 - 1.5, w + 3, lh + 3, "F");
      doc.addImage(logo.dataUrl, "PNG", M, 4, w, lh, undefined, "FAST");
    } else drawPsgLogo(doc, logo, M, 4, w, lh);
    x = M + w + 5;
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(q.entity?.name ?? "Production Solutions Group", x, 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`${q.kind ?? "Quote"} ${q.number}`, W - M, 13, { align: "right" });

  // To / details
  doc.setTextColor(0, 0, 0);
  let y = 36;
  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(q.title, W - 2 * M - 60) as string[];
  doc.text(titleLines, M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 90, 100);
  const right = [
    `${q.kind ?? "Quote"} ${q.number}`,
    `Date ${fmtDate(q.sentAt ?? q.createdAt)}`,
    q.validUntil ? `Valid until ${fmtDate(q.validUntil)}` : null,
    ...(q.extraLines ?? []),
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
    if (sec) body.push([{ content: sec, colSpan: 4, styles: { fontStyle: "bold", fillColor: brand.tint, textColor: brand.accentInk } }]);
    for (const l of ls) body.push([l.description, `${qty(l.quantity)}${l.unit ? ` ${l.unit}` : ""}`, { content: gbp(l.unitPrice), styles: { halign: "right" } }, { content: gbp(l.quantity * l.unitPrice), styles: { halign: "right" } }]);
    if (q.showSubtotals && sections.length > 1) {
      const sub = ls.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      body.push([{ content: `${sec || "Other"} subtotal`, colSpan: 3, styles: { halign: "right", fontStyle: "bold" } }, { content: gbp(sub), styles: { halign: "right", fontStyle: "bold" } }]);
    }
  }
  const t = quoteTotals(q.lines, q.vatRate);
  const R = (s: string, bold = false) => ({ content: s, styles: { halign: "right" as const, fontStyle: bold ? "bold" as const : "normal" as const } });
  if (q.pdfDetail === "items") {
    // One price per item: each section is an item at its total; lines with no section are items
    // in their own right. The breakdown (labour, materials, quantities) stays in the Hub.
    const items: [string, number][] = [];
    for (const sec of sections) {
      const ls = q.lines.filter(l => (l.section ?? "") === sec);
      if (sec) items.push([sec, ls.reduce((s2, l) => s2 + l.quantity * l.unitPrice, 0)]);
      else for (const l of ls) items.push([l.description, l.quantity * l.unitPrice]);
    }
    autoTable(doc, {
      startY: y,
      head: [["Item", R("Price")]] as never,
      body: items.map(([n, v]) => [n, R(gbp(v))]) as never,
      foot: [[R("Subtotal"), R(gbp(t.net))], [R(`VAT ${q.vatRate}%`), R(gbp(t.vat))], [R("Total", true), R(gbp(t.gross), true)]] as never,
      styles: { fontSize: 10, cellPadding: 2.5 },
      headStyles: { fillColor: brand.header },
      footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      columnStyles: { 1: { cellWidth: 40 } },
      margin: { left: M, right: M },
    });
  } else autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", R("Rate"), R("Amount")]] as never,
    body: body as never,
    foot: [
      ["", "", R("Subtotal"), R(gbp(t.net))],
      ["", "", R(`VAT ${q.vatRate}%`), R(gbp(t.vat))],
      ["", "", R("Total", true), R(gbp(t.gross), true)],
    ] as never,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: brand.header },
    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
    columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 24 } },
    margin: { left: M, right: M },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (q.terms) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...brand.accentInk);
    doc.text("Terms", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
    doc.text(doc.splitTextToSize(q.terms, W - 2 * M) as string[], M, y + 5);
  }
  // Footer: who it's from and the quote number on every page (not "Exported", it's a client document)
  const pages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(140, 140, 160);
    doc.text(`${q.entity?.name ?? "Production Solutions Group"} · ${q.kind ?? "Quote"} ${q.number}`, M, 290);
    doc.text(`Page ${i} of ${pages}`, W - M, 290, { align: "right" });
  }
  return doc;
}

/** The PDF as a blob URL, for previewing on screen without downloading. Revoke it when done. */
export async function quotePdfUrl(q: QuoteForPdf) {
  const brand = brandFor(q.entity);
  const logo = await fetchLogoAsset(brand.logoUrl ?? undefined);
  return URL.createObjectURL(buildQuotePDF(q, logo, brand).output("blob"));
}

/** A variation on a build as a PDF, in the builder's look (like its quotes). */
export async function downloadVariationPDF(v: VariationForPdf) {
  const q: QuoteForPdf = {
    kind: "Variation", number: `${v.jobNumber}-${v.label}`, title: `${v.label}: ${v.title}`, vatRate: v.vatRate, validUntil: null, createdAt: v.createdAt, sentAt: v.sentAt,
    terms: [v.notes, `This variation is to ${v.jobTitle} (${v.jobNumber}). Once approved, it is added to the price of the build.`].filter(Boolean).join("\n\n"),
    extraLines: v.decidedAt ? [`${v.status === "approved" ? "Approved" : "Declined"} ${fmtDate(v.decidedAt)}${v.decidedByName ? ` by ${v.decidedByName}` : ""}`] : [],
    entity: v.entity, client: v.client,
    lines: v.lines.map(l => ({ ...l, unitCost: 0 })),
  };
  const brand = brandFor(q.entity);
  const logo = await fetchLogoAsset(brand.logoUrl ?? undefined);
  buildQuotePDF(q, logo, brand).save(`${q.number} ${v.title}.pdf`.replace(/[\\/:*?"<>|]/g, "-"));
}
export type VariationForPdf = {
  label: string; title: string; notes: string | null; vatRate: number; status: string; createdAt: string; sentAt: string | null; decidedAt: string | null; decidedByName: string | null;
  jobNumber: string; jobTitle: string; entity: QuoteForPdf["entity"]; client: QuoteForPdf["client"];
  lines: { section: string | null; description: string; quantity: number; unit: string | null; unitPrice: number }[];
};

export async function downloadQuotePDF(q: QuoteForPdf) {
  const brand = brandFor(q.entity);
  const logo = await fetchLogoAsset(brand.logoUrl ?? undefined);
  buildQuotePDF(q, logo, brand).save(`${q.number} ${q.title}.pdf`.replace(/[\\/:*?"<>|]/g, "-"));
}
