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
export type Brand = { header: Rgb; rule: Rgb | null; tint: Rgb; accentInk: Rgb; logoUrl: string | null; logoGround?: Rgb };
const PSG_BRAND: Brand = { header: [10, 25, 65], rule: null, tint: [236, 239, 247], accentInk: [10, 25, 65], logoUrl: null };
/** PSG's own letterhead in the sales-quote layout (PSG Rentals & Crew): PSG logo, navy and PSG blue. */
export const PSG_SALES_BRAND: Brand = { header: [0, 12, 59], rule: [61, 68, 212], tint: [233, 236, 247], accentInk: [13, 18, 102], logoUrl: "/psg-logo.png", logoGround: [255, 255, 255] };

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
  entity: { name: string; hasSpace?: boolean; slug?: string | null; color?: string | null; logoMime?: string | null; updatedAt?: string | Date; address?: string | null; phone?: string | null } | null;
  // Sales-quote boxes (a space's layout); each falls back to the linked job where it can
  customerPo?: string | null; paymentTerms?: string | null; dueDate?: string | null; shippingMethod?: string | null; shipTo?: string | null;
  createdBy?: { name: string } | null;
  job?: { endDate?: string | null; deliveryMethod?: string | null; deliveryNotes?: string | null } | null;
  client: { name: string; billingName: string | null; billingAddress: string | null; address: string | null; billingEmail: string | null } | null;
  lines: { section: string | null; description: string; quantity: number; unit: string | null; unitCost: number; unitPrice: number; kind?: string | null; hideLine?: boolean; hidePrice?: boolean; leaveOut?: boolean }[];
};

export function buildQuotePDF(q0: QuoteForPdf, logo?: LogoAsset, brand: Brand = brandFor(q0.entity)): jsPDF {
  // Items left out aren't on the client's PDF at all (nor in its totals)
  const q = { ...q0, lines: q0.lines.filter(l => !l.leaveOut) };
  // A company with its own space (TWS) sends a sales quote in its own letterhead layout
  if (brand.rule) return buildSalesQuotePDF(q, logo, brand);
  const doc = pdfSafe(new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }));
  const W = 210, M = 14;
  doc.setFillColor(...brand.header);
  doc.rect(0, 0, W, 24, "F");
  let x = M;
  if (logo) {
    const h = 16, w = Math.min(36, (logo.w / logo.h) * h);
    const lh = w / (logo.w / logo.h);
    drawPsgLogo(doc, logo, M, 4, w, lh);
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
    q.customerPo ? `Your PO ${q.customerPo}` : null,
    q.paymentTerms ? `Payment ${q.paymentTerms}` : null,
    q.dueDate ? `Due ${fmtDate(q.dueDate)}` : null,
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
    for (const l of ls) {
      if (l.hideLine) continue; // muted: counted in the subtotal and totals, not shown
      const hp = !!l.hidePrice; // shown without its price
      body.push([l.description, `${qty(l.quantity)}${l.unit ? ` ${l.unit}` : ""}`, { content: hp ? "" : gbp(l.unitPrice), styles: { halign: "right" } }, { content: hp ? "" : gbp(l.quantity * l.unitPrice), styles: { halign: "right" } }]);
    }
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
      else for (const l of ls) if (!l.hideLine) items.push([l.description, l.quantity * l.unitPrice]);
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

// ── Sales quote layout (TWS, 27 Nov 2026) ─────────────────────────────────────
// Modelled on the workshop's existing sales quotes: letterhead with logo, address and phone; the
// document name and number on the right; boxed client / ship-to and details; lines grouped by
// section with a total under each; totals on the right; page count and print time at the foot.

const TIME_UNITS = /^(hours?|days?|weeks?|shows?)$/i;
/** The resource type column, from the line's section (else its unit: time is labour). */
export function resourceType(section: string | null, unit?: string | null): string {
  const s = (section ?? "").trim().toLowerCase();
  const byUnit = unit && /^(hours?|days?|weeks?)$/i.test(unit.trim()) ? "Labour" : "Misc";
  if (!s) return byUnit;
  if (["labour", "design", "fit-up", "get-out", "running", "pre-production"].includes(s)) return "Labour";
  if (s === "transport") return "Transport";
  if (s === "tools & kit") return "Kit";
  if (["timber", "sheet materials", "steel & metal", "paint & finishes", "fixings & hardware", "fabric & soft goods", "consumables", "materials"].includes(s)) return "Material";
  return byUnit;
}
// kit, discount, transport and charge are used by hire quotes (PSG Rentals & Crew)
const KIND_LABEL: Record<string, string> = { material: "Material", labour: "Labour", misc: "Misc", kit: "Kit", discount: "Discount", transport: "Transport", charge: "Charge" };
const cap = (u: string | null) => (u ? u.charAt(0).toUpperCase() + u.slice(1) : "Each");
const money = (n: number) => new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const SHIPPING: Record<string, string> = { collection: "Client collection", delivery: "Delivered by us" };

export function buildSalesQuotePDF(q0: QuoteForPdf, logo: LogoAsset | undefined, brand: Brand): jsPDF {
  const q = { ...q0, lines: q0.lines.filter(l => !l.leaveOut) }; // items left out aren't on the PDF
  const doc = pdfSafe(new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }));
  const W = 210, M = 12, ink: Rgb = [25, 25, 28], soft: Rgb = [95, 98, 105], line: Rgb = [70, 72, 78];
  // A variation, a hire quote or hire confirmation says so; anything else is a sales quote
  const kind = q.kind && q.kind !== "Quote" ? q.kind : "Sales Quote";

  // Letterhead: logo, then the company's address and phone
  let x = M;
  if (logo) {
    const h = 22, w = Math.min(46, (logo.w / logo.h) * h), lh = w / (logo.w / logo.h);
    // On the company's paper ground (TWS's logo has a white T that would vanish on white)
    doc.setFillColor(...(brand.logoGround ?? [245, 242, 236])); doc.rect(M - 1.5, 10 - 1.5, w + 3, lh + 3, "F");
    doc.addImage(logo.dataUrl, "PNG", M, 10, w, lh, undefined, "FAST");
    x = M + w + 6;
  }
  doc.setTextColor(...ink); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  const letter = [q.entity?.name ?? "", ...(q.entity?.address ?? "").split(/\r?\n/).map(l => l.trim()).filter(Boolean), q.entity?.phone ? `Phone: ${q.entity.phone}` : ""].filter(Boolean);
  letter.forEach((t, i) => { if (i === 0) doc.setFont("helvetica", "bold"); else doc.setFont("helvetica", "normal"); doc.text(t, x, 13 + i * 4.2); });

  // Document name, number and title on the right
  const cx = W - M - 38;
  doc.setFont("helvetica", "bold"); doc.setFontSize(21); doc.text(kind, cx, 17, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.text(`Number: ${q.number}`, cx, 23, { align: "center" });
  doc.setFontSize(10);
  const title = (doc.splitTextToSize(q.title, 76) as string[]).slice(0, 2);
  doc.text(title, cx, 28.5, { align: "center" });
  const headBottom = Math.max(13 + letter.length * 4.2, 28.5 + title.length * 4.2, 34) + 2;
  // The company's own colour as a rule under the letterhead
  doc.setFillColor(...(brand.rule ?? brand.header)); doc.rect(M, headBottom, W - 2 * M, 1.2, "F");

  doc.setDrawColor(...line); doc.setLineWidth(0.25);
  // Client / Ship to boxes
  let y = headBottom + 5;
  const half = (W - 2 * M - 6) / 2;
  const client = q.client ? [q.client.billingName ?? q.client.name, q.client.billingAddress ?? q.client.address, q.client.billingEmail].filter(Boolean).join("\n") : "";
  const shipTo = q.shipTo ?? (q.job?.deliveryMethod === "delivery" ? q.job.deliveryNotes ?? "" : "");
  doc.setFontSize(9.5);
  const cl = doc.splitTextToSize(client, half - 4) as string[], sl = doc.splitTextToSize(shipTo, half - 4) as string[];
  const bodyH = Math.max(cl.length, sl.length, 1) * 4.2 + 3;
  const box = (bx: number, label: string, lines: string[]) => {
    doc.setFillColor(...brand.tint); doc.rect(bx, y, half, 6, "FD");
    doc.setFont("helvetica", "bold"); doc.setTextColor(...ink); doc.text(label, bx + 2, y + 4.2);
    doc.rect(bx, y + 6, half, bodyH);
    doc.setFont("helvetica", "normal"); doc.text(lines, bx + 2, y + 10.2);
  };
  box(M, "Client", cl); box(M + half + 6, "Ship To", sl);
  y += 6 + bodyH + 5;

  // Two rows of details
  const day = (iso: string | null | undefined) => (iso ? fmtDate(iso) : "");
  const rows: [string, string][][] = [
    [["Sales Person", q.createdBy?.name ?? ""], ["Customer PO", q.customerPo ?? ""], ["Terms", q.paymentTerms ?? ""], ["Sales Tax", `VAT ${q.vatRate}%`]],
    [["Date", day(q.sentAt ?? q.createdAt)], ["Due Date", day(q.dueDate ?? q.job?.endDate)], ["Shipping Method", q.shippingMethod ?? SHIPPING[q.job?.deliveryMethod ?? ""] ?? ""], ["Valid Until", day(q.validUntil)]],
  ];
  const cw = (W - 2 * M) / 4;
  doc.setFontSize(8.5);
  for (const r of rows) {
    r.forEach(([label, value], i) => {
      const bx = M + i * cw;
      doc.setFillColor(...brand.tint); doc.rect(bx, y, cw, 5, "FD");
      doc.setFont("helvetica", "bold"); doc.text(label, bx + cw / 2, y + 3.5, { align: "center" });
      doc.rect(bx, y + 5, cw, 5);
      doc.setFont("helvetica", "normal"); doc.text((doc.splitTextToSize(value, cw - 3) as string[])[0] ?? "", bx + cw / 2, y + 8.6, { align: "center" });
    });
    y += 13;
  }
  y += 2;

  // Lines, grouped by section in the order they first appear, each with its total
  const sections: string[] = [];
  for (const l of q.lines) if (!sections.includes(l.section ?? "")) sections.push(l.section ?? "");
  const R = (c: string, bold = false) => ({ content: c, styles: { halign: "right" as const, fontStyle: bold ? ("bold" as const) : ("normal" as const) } });
  const body: unknown[][] = [];
  const sectionTotal = (sec: string) => q.lines.filter(l => (l.section ?? "") === sec).reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  if (q.pdfDetail === "items") {
    // One price per item: each section is one line at its total (the breakdown stays in the Hub)
    for (const sec of sections) {
      const ls = q.lines.filter(l => (l.section ?? "") === sec);
      const items: [string, number][] = sec ? [[sec, sectionTotal(sec)]] : ls.filter(l => !l.hideLine).map(l => [l.description, l.quantity * l.unitPrice]);
      for (const [name, v] of items) {
        body.push([{ content: name, colSpan: 6, styles: { fontStyle: "bold", textColor: brand.accentInk } }]);
        body.push([resourceType(sec || null), "1", name, "Each", R(money(v)), R(money(v))]);
        body.push([{ content: `${name} Total`, colSpan: 5, styles: { halign: "right", fontStyle: "bold" } }, R(`£${money(v)}`, true)]);
      }
    }
  } else {
    for (const sec of sections) {
      const ls = q.lines.filter(l => (l.section ?? "") === sec);
      if (sec) body.push([{ content: sec, colSpan: 6, styles: { fontStyle: "bold", textColor: brand.accentInk } }]);
      for (const l of ls) {
        if (l.hideLine) continue; // muted: counted in the item total, not shown
        const unit = l.unit && !TIME_UNITS.test(l.unit) ? cap(l.unit) : l.unit ? cap(l.unit.replace(/s$/, "")) : "Each";
        const type = l.kind ? KIND_LABEL[l.kind] ?? "Misc" : resourceType(l.section, l.unit);
        body.push([type, qty(l.quantity), l.description, unit, R(l.hidePrice ? "" : money(l.unitPrice)), R(l.hidePrice ? "" : money(l.quantity * l.unitPrice))]);
      }
      if (sec) body.push([{ content: `${sec} Total`, colSpan: 5, styles: { halign: "right", fontStyle: "bold" } }, R(`£${money(sectionTotal(sec))}`, true)]);
    }
  }
  autoTable(doc, {
    startY: y,
    theme: "plain",
    head: [["Type", "Qty", "Description", "Rate", R("Price", true), R("Amount", true)]] as never,
    body: body as never,
    styles: { fontSize: 8.5, cellPadding: { top: 1.4, bottom: 1.4, left: 1.5, right: 1.5 }, textColor: ink },
    headStyles: { fontStyle: "bold", textColor: ink, lineWidth: { bottom: 0.4 }, lineColor: line },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 12, halign: "right" }, 3: { cellWidth: 18 }, 4: { cellWidth: 24 }, 5: { cellWidth: 26 } },
    margin: { left: M, right: M, bottom: 18 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Totals, right-aligned
  const t = quoteTotals(q.lines, q.vatRate);
  if (y > 255) { doc.addPage(); y = 20; }
  const tx = W - M - 75;
  const totals: [string, number, boolean][] = [["Subtotal:", t.net, false], [`Sales Tax (VAT ${q.vatRate}%):`, t.vat, false], ["Total:", t.gross, true]];
  doc.setFontSize(10.5);
  totals.forEach(([label, v, bold], i) => {
    const ty = y + i * 6.5;
    if (bold) { doc.setDrawColor(...line); doc.line(tx, ty - 4.6, W - M, ty - 4.6); }
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setTextColor(...ink);
    doc.text(label, tx, ty); doc.text(`£${money(v)}`, W - M, ty, { align: "right" });
  });
  y += totals.length * 6.5 + 6;

  if (q.terms || q.extraLines?.length) {
    const text = [...(q.extraLines ?? []), q.terms ?? ""].filter(Boolean).join("\n\n");
    const tl = doc.splitTextToSize(text, W - 2 * M) as string[];
    if (y + tl.length * 4 > 278) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...brand.accentInk); doc.text("Terms", M, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...soft); doc.text(tl, M, y + 4.5);
  }

  // Footer: company and number left, page count centre, when it was printed right
  const pages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  const printed = new Date().toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).replace(",", "");
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...soft);
    doc.text(`${q.entity?.name ?? ""} · ${kind} ${q.number}`, M, 289);
    doc.text(`Page ${i} of ${pages}`, W / 2, 289, { align: "center" });
    doc.text(printed, W - M, 289, { align: "right" });
  }
  return doc;
}
