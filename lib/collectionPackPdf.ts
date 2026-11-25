// A build's collection pack (27 Nov 2026), in the builder's look (like its quotes): the build and
// when it goes, the load list (pieces, sizes, weights, totals), FR certificates, drawings and their
// sign-off, and the ready-to-collect checks. Certificate files themselves are opened from the Hub.
import jsPDF from "jspdf";
import { autoTable, drawPsgLogo, fetchLogoAsset, pdfSafe } from "@/lib/exports";
import { brandFor } from "@/lib/quotePdf";
import { fmtDate } from "@/lib/format";

export type PackData = {
  number: string; title: string; endDate: string | null; deliveryMethod: string | null;
  client: { name: string; address: string | null } | null; forProduction: { name: string } | null;
  entity: { name: string; hasSpace?: boolean; slug?: string | null; color?: string | null; logoMime?: string | null; updatedAt?: string } | null;
  storedPieces: { id: number; name: string; quantity: number; lengthMm: number | null; widthMm: number | null; heightMm: number | null; weightKg: number | null; outAt: string | null; location: { name: string } | null }[];
  drawings: { number: string | null; title: string; revisions: { rev: string; status: string }[] }[];
  checks: { text: string; done: boolean }[];
  certs: { title: string; standard: string | null; supplier: string | null; issuedAt: string | null; expiresAt: string | null; expired: boolean }[];
};

export async function downloadCollectionPack(d: PackData) {
  const brand = brandFor(d.entity);
  const logo = await fetchLogoAsset(brand.logoUrl ?? undefined);
  const doc = pdfSafe(new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }));
  const W = 210, M = 14;
  // Header in the builder's colours
  doc.setFillColor(...brand.header); doc.rect(0, 0, W, 24, "F");
  if (brand.rule) { doc.setFillColor(...brand.rule); doc.rect(0, 24, W, 1.4, "F"); }
  let x = M;
  if (logo) {
    const h = 16, w = Math.min(36, (logo.w / logo.h) * h), lh = w / (logo.w / logo.h);
    if (brand.rule) { doc.setFillColor(245, 242, 236); doc.rect(M - 1.5, 2.5, w + 3, lh + 3, "F"); doc.addImage(logo.dataUrl, "PNG", M, 4, w, lh, undefined, "FAST"); }
    else drawPsgLogo(doc, logo, M, 4, w, lh);
    x = M + w + 5;
  }
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(d.entity?.name ?? "Production Solutions Group", x, 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Collection pack", W - M, 13, { align: "right" });

  let y = 36;
  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  const t = doc.splitTextToSize(d.title, W - 2 * M) as string[];
  doc.text(t, M, y); y += t.length * 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(70, 70, 80);
  const facts = [
    `Build ${d.number}`,
    d.client ? `For ${d.client.name}${d.forProduction ? ` · ${d.forProduction.name}` : ""}` : d.forProduction ? `For ${d.forProduction.name}` : null,
    d.endDate ? `${d.deliveryMethod === "delivery" ? "Delivery" : d.deliveryMethod === "collection" ? "Collection" : "Due out"}: ${fmtDate(d.endDate)}` : null,
    `Pack printed ${fmtDate(new Date().toISOString())}`,
  ].filter(Boolean) as string[];
  facts.forEach(f => { doc.text(f, M, y); y += 4.8; });
  y += 3;

  const section = (title: string) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...brand.accentInk);
    doc.text(title, M, y); y += 2.5;
  };
  const table = (head: string[], body: (string | { content: string; styles?: object })[][], foot?: (string | { content: string; styles?: object })[][], widths?: Record<number, object>) => {
    autoTable(doc, { startY: y, head: [head] as never, body: body as never, foot: foot as never, styles: { fontSize: 8.5, cellPadding: 1.8 }, headStyles: { fillColor: brand.header }, footStyles: { fillColor: brand.tint, textColor: [0, 0, 0], fontStyle: "bold" }, columnStyles: widths as never, margin: { left: M, right: M } });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  };

  // Load list: pieces still with us (in store or in the workshop)
  const load = d.storedPieces.filter(p => !p.outAt);
  section("Load list");
  if (load.length) {
    const kg = (n: number) => `${Math.round(n * 10) / 10} kg`;
    const total = load.reduce((s, p) => s + (p.weightKg ?? 0) * p.quantity, 0);
    const missing = load.filter(p => p.weightKg == null).length;
    table(
      ["Piece", "Qty", "Size (L × W × H mm)", "Weight each", "Weight total", "Where now"],
      load.map(p => [p.name, String(p.quantity), [p.lengthMm, p.widthMm, p.heightMm].some(Boolean) ? [p.lengthMm ?? "?", p.widthMm ?? "?", p.heightMm ?? "?"].join(" × ") : "", p.weightKg != null ? kg(p.weightKg) : "", p.weightKg != null ? kg(p.weightKg * p.quantity) : "", p.location?.name ?? "Workshop"]),
      [["Total", String(load.reduce((s, p) => s + p.quantity, 0)), "", "", { content: `${kg(total)}${missing ? ` (+${missing} not weighed)` : ""}` }, ""]],
      { 0: { cellWidth: 52 }, 1: { cellWidth: 12, halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    );
  } else { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 90, 100); doc.text("No pieces recorded for this build yet.", M, y + 3); y += 10; }

  section("Flame-retardant certificates");
  if (d.certs.length) table(["Covers", "Standard", "Supplier / treated by", "Issued", "Valid until"],
    d.certs.map(c => [c.title, c.standard ?? "", c.supplier ?? "", c.issuedAt ? fmtDate(c.issuedAt) : "", c.expiresAt ? `${fmtDate(c.expiresAt)}${c.expired ? " (EXPIRED)" : ""}` : ""]));
  else { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(170, 40, 30); doc.text("No flame-retardant certificates on file for this build.", M, y + 3); y += 10; }

  section("Drawings");
  if (d.drawings.length) table(["Drawing", "Latest revision", "Sign-off"],
    d.drawings.map(dr => { const r = dr.revisions[0]; return [`${dr.number ? `${dr.number} · ` : ""}${dr.title}`, r?.rev ?? "", r ? (r.status === "approved" ? "Signed off" : r.status === "changes" ? "Changes asked for" : "Awaiting sign-off") : ""]; }));
  else { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 90, 100); doc.text("No drawings on this build.", M, y + 3); y += 10; }

  if (d.checks.length) {
    section("Ready to collect");
    table(["Check", "Done"], d.checks.map(c => [c.text, c.done ? "Yes" : "Not yet"]), undefined, { 1: { cellWidth: 24 } });
  }

  // Signatures for handover
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setDrawColor(150, 150, 160); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(70, 70, 80);
  doc.text("Handed over by", M, y + 4); doc.line(M + 28, y + 4, M + 88, y + 4);
  doc.text("Received by", M + 98, y + 4); doc.line(M + 120, y + 4, W - M, y + 4);
  doc.text("Date", M, y + 14); doc.line(M + 28, y + 14, M + 88, y + 14);

  const pages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(140, 140, 160);
    doc.text(`${d.entity?.name ?? "Production Solutions Group"} · ${d.number} collection pack`, M, 290);
    doc.text(`Page ${i} of ${pages}`, W - M, 290, { align: "right" });
  }
  doc.save(`${d.number} ${d.title} collection pack.pdf`.replace(/[\\/:*?"<>|]/g, "-"));
}
