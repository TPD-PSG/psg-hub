// Budget PDF and Excel exports. Figures come from lib/budgetReport.ts, the same calculation the
// Budget tab uses, so an export always matches the screen. The build* functions don't touch the
// browser (they can run in Node for checking); the export* functions add logos and download.
import type jsPDF from "jspdf";
import type { CellHookData } from "jspdf-autotable";
import ExcelJS from "exceljs";
import { fmtDate } from "@/lib/format";
import { autoTable, basePDF, addFooters, fetchLogoAsset, saveXlsx, type LogoAsset } from "@/lib/exports";
import {
  VARIATION_STATUSES, VARIATION_TYPES,
  type BudgetReport, type Figures, type ReportExpense, type ReportMovement, type ReportVariation,
} from "@/lib/budgetReport";

const NAVY: [number, number, number] = [10, 25, 65];
const SUB: [number, number, number] = [30, 50, 100];
const RED: [number, number, number] = [200, 30, 30];

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const money = (n: number | null | undefined) => (n == null || n === 0 ? "–" : gbp(n));
const pctUsed = (f: Figures) => (f.allocation > 0 ? `${Math.round((f.net / f.allocation) * 100)}%` : "–");
const phaseLabel = (p: string) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : "");
const slug = (name: string) => name.replace(/\s+/g, "-").toLowerCase();
const variationTotal = (v: ReportVariation) => v.items.reduce((s, i) => s + i.amount, 0);
const decidedBy = (v: ReportVariation) =>
  v.status === "approved" || v.status === "rejected" ? (v.approvedBy?.name ?? "") : "";

// ── PDF ──────────────────────────────────────────────────────────────────────

export function buildBudgetPDF(
  productionName: string,
  report: BudgetReport,
  variations: ReportVariation[],
  logo?: LogoAsset,
  prodLogo?: LogoAsset,
  exportedAt = new Date(),
): jsPDF {
  const doc = basePDF(`Budget — ${productionName}`, `Exported ${fmtDate(exportedAt.toISOString())}`, logo, prodLogo);
  const margin = { left: 10, right: 10 };
  const last = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  // Start a new page rather than leave a heading stranded at the foot of one
  const heading = (text: string, y: number, room = 40) => {
    if (y > 200 - room) { doc.addPage(); y = 15; }
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY);
    doc.text(text, 10, y);
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
    return y + 3;
  };
  // Colour a cell red when its number is negative (variance) — raw values ride along in `neg`
  const redIfNegative = (cols: number[]) => (d: CellHookData) => {
    const raw = (d.cell.raw as { neg?: boolean } | undefined)?.neg;
    if (cols.includes(d.column.index) && raw) d.cell.styles.textColor = RED;
  };
  const varianceCell = (n: number) => ({ content: gbp(n), neg: n < 0, styles: { halign: "right" as const } });
  // columnStyles don't reach header/footer rows, so footer totals are aligned here
  const R = (content: string) => ({ content, styles: { halign: "right" as const } });
  const t = report.totals;

  // Headline figures
  autoTable(doc, {
    startY: 32,
    head: [["Allocation", "PM Budget", "Net Cost", "Gross Cost", "Variance (Allocation - Net)"]],
    body: [[gbp(t.allocation), gbp(t.pm), gbp(t.net), gbp(t.gross), { content: gbp(t.variance), neg: t.variance < 0 }]] as never,
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: NAVY },
    didParseCell: redIfNegative([4]),
    margin,
  });

  // By department
  let y = heading("By department", last() + 9);
  const deptRows: unknown[][] = report.departments.map(d => [
    d.name, d.lines.length, gbp(d.allocation), money(d.pm), money(d.net), money(d.gross), varianceCell(d.variance), pctUsed(d),
  ]);
  if (report.unlinkedHaulage.movements.length)
    deptRows.push(["Haulage (not linked to a line)", report.unlinkedHaulage.movements.length, "–", money(report.unlinkedHaulage.pm), money(report.unlinkedHaulage.net), "–", "–", "–"]);
  if (report.contra.stops.length)
    deptRows.push(["Venue contra", report.contra.stops.length, "–", money(report.contra.pm), money(report.contra.net), "–", "–", "–"]);
  autoTable(doc, {
    startY: y,
    head: [["Department", "Lines", "Allocation", "PM Budget", "Net Cost", "Gross Cost", "Variance", "% used"]],
    body: deptRows as never,
    foot: [["TOTAL", "", R(gbp(t.allocation)), R(gbp(t.pm)), R(gbp(t.net)), R(gbp(t.gross)), varianceCell(t.variance), R(pctUsed(t))]] as never,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: NAVY },
    footStyles: { fillColor: [230, 233, 242], textColor: NAVY, fontStyle: "bold" },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
    didParseCell: redIfNegative([6]),
    margin,
  });

  // Detail: every line with its spend, linked haulage and PSG expenses
  const itemRow = (x: ReportExpense) => [
    phaseLabel(x.phase), x.description, x.supplier ?? "", x.poNumber ?? "", x.paymentDue ? fmtDate(x.paymentDue, "") : "",
    money(x.estimated), money(x.committed), money(x.spent), x.issuedForPayment ? "Issued" : "Pending",
  ];
  const detailCols = { 5: { halign: "right" as const }, 6: { halign: "right" as const }, 7: { halign: "right" as const } };
  y = last() + 10;
  for (const d of report.departments) {
    y = heading(`${d.name}  ·  Allocation ${gbp(d.allocation)}  ·  Remaining ${gbp(d.variance)}`, y);
    for (const line of d.lines) {
      const body = [
        ...line.items.map(itemRow),
        ...line.movements.map(m => [
          "Haulage", `${m.haulageCompany}: ${m.fromLocation} to ${m.toLocation}${m.cargo ? ` (${m.cargo})` : ""}`, "", "",
          fmtDate(m.departureAt, ""), money(m.estimatedCost), money(m.actualCost), "–", m.rechargeable ? "Rechargeable" : "",
        ]),
        ...line.psgItems.map(x => [
          "PSG expense", x.description, x.supplier ?? "", x.paymentMethod ?? "", x.paymentDue ? fmtDate(x.paymentDue, "") : "",
          "–", money(x.committed), money(x.spent), "",
        ]),
      ];
      const title = `${line.description}${line.nominalCode ? `  [${line.nominalCode}]` : ""}`;
      autoTable(doc, {
        startY: y,
        head: [
          [{ content: title, colSpan: 5, styles: { fillColor: SUB, textColor: 255 } },
            { content: `Allocation ${gbp(line.allocation)}  ·  Remaining ${gbp(line.variance)}  ·  ${pctUsed(line)} used`, colSpan: 4, styles: { fillColor: SUB, textColor: line.variance < 0 ? [255, 170, 170] : 255, halign: "right" } }],
          ["Phase", "Description", "Supplier", "PO / method", "Due", "PM Budget", "Net Cost", "Gross Cost", "Status"],
        ],
        body: body.length ? body : [["", "No items yet", "", "", "", "", "", "", ""]],
        foot: body.length ? [["", "Line total", "", "", "", R(gbp(line.pm)), R(gbp(line.net)), R(gbp(line.gross)), ""]] : undefined,
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: NAVY },
        footStyles: { fillColor: [240, 242, 248], textColor: NAVY, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 75 }, 4: { cellWidth: 22 }, 8: { cellWidth: 22 }, ...detailCols },
        margin,
      });
      y = last() + 4;
    }
    y += 4;
  }

  if (report.unlinkedHaulage.movements.length) {
    y = heading("Haulage not linked to a budget line", y);
    autoTable(doc, {
      startY: y,
      head: [["Company", "Route", "Cargo", "Departure", "Estimate (PM)", "Actual (Net)", "Rechargeable"]],
      body: report.unlinkedHaulage.movements.map(m => [m.haulageCompany, `${m.fromLocation} to ${m.toLocation}`, m.cargo ?? "", fmtDate(m.departureAt, ""), money(m.estimatedCost), money(m.actualCost), m.rechargeable ? "Yes" : ""]),
      foot: [["Total", "", "", "", R(gbp(report.unlinkedHaulage.pm)), R(gbp(report.unlinkedHaulage.net)), ""]],
      styles: { fontSize: 8, cellPadding: 1.8 }, headStyles: { fillColor: NAVY },
      footStyles: { fillColor: [240, 242, 248], textColor: NAVY, fontStyle: "bold" },
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } }, margin,
    });
    y = last() + 8;
  }

  if (report.contra.stops.length) {
    y = heading("Venue contra", y);
    autoTable(doc, {
      startY: y,
      head: [["#", "Venue", "Estimate (PM)", "Actual (Net)"]],
      body: report.contra.stops.map(s => [s.stopNumber, `${s.venue.name}${s.venue.city ? `, ${s.venue.city}` : ""}`, money(s.contraEstimate), money(s.contraActual)]),
      foot: [["", "Total", R(gbp(report.contra.pm)), R(gbp(report.contra.net))]],
      styles: { fontSize: 8, cellPadding: 1.8 }, headStyles: { fillColor: NAVY },
      footStyles: { fillColor: [240, 242, 248], textColor: NAVY, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 12 }, 2: { halign: "right" }, 3: { halign: "right" } }, margin,
    });
    y = last() + 8;
  }

  y = heading("Budget variations", y);
  autoTable(doc, {
    startY: y,
    head: [["Requested", "Title", "Type", "Status", "Lines affected", "Change", "Requested by", "Decided by", "Client ref"]],
    body: variations.length
      ? variations.map(v => [
        fmtDate(v.requestedAt, ""), v.title, VARIATION_TYPES[v.type] ?? v.type, VARIATION_STATUSES[v.status] ?? v.status,
        v.items.map(i => `${i.budgetLine.department} — ${i.budgetLine.description}: ${i.amount >= 0 ? "+" : ""}${gbp(i.amount)}`).join("\n"),
        { content: `${variationTotal(v) >= 0 ? "+" : ""}${gbp(variationTotal(v))}`, neg: variationTotal(v) < 0 },
        v.requestedBy?.name ?? "", [decidedBy(v), v.approvedAt ? fmtDate(v.approvedAt, "") : ""].filter(Boolean).join(", "), v.clientRef ?? "",
      ]) as never
      : [["", "No budget variations", "", "", "", "", "", "", ""]],
    styles: { fontSize: 8, cellPadding: 1.8 }, headStyles: { fillColor: NAVY },
    columnStyles: { 4: { cellWidth: 70 }, 5: { halign: "right" } },
    didParseCell: redIfNegative([5]),
    margin,
  });

  addFooters(doc);
  return doc;
}

export async function exportBudgetPDF(productionName: string, report: BudgetReport, variations: ReportVariation[], productionLogoUrl?: string | null) {
  const [logo, prodLogo] = await Promise.all([fetchLogoAsset(), productionLogoUrl ? fetchLogoAsset(productionLogoUrl) : Promise.resolve(null)]);
  buildBudgetPDF(productionName, report, variations, logo, prodLogo ?? undefined).save(`budget-${slug(productionName)}.pdf`);
}

// ── Client report (PDF) ──────────────────────────────────────────────────────
// For sending to the client: totals by department and budget line (no suppliers, POs or
// individual items), approved and pending variations, rechargeables still to invoice, and an
// optional covering note. Drafts and rejected variations stay internal.

export type ClientReportInput = {
  productionName: string;
  report: BudgetReport;
  variations: ReportVariation[];
  rechargeables: ReportMovement[];
  note?: string;
  preparedBy?: string | null;
};

export function buildClientBudgetPDF(input: ClientReportInput, logo?: LogoAsset, prodLogo?: LogoAsset, exportedAt = new Date()): jsPDF {
  const { productionName, report, variations, note, preparedBy } = input;
  const subtitle = [`Budget report · ${fmtDate(exportedAt.toISOString())}`, preparedBy ? `Prepared by ${preparedBy}` : null].filter(Boolean).join(" · ");
  const doc = basePDF(`Budget report — ${productionName}`, subtitle, logo, prodLogo);
  const margin = { left: 10, right: 10 };
  const last = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const R = (content: string) => ({ content, styles: { halign: "right" as const } });
  const V = (n: number) => ({ content: gbp(n), neg: n < 0, styles: { halign: "right" as const } });
  const redIfNegative = (d: CellHookData) => { if ((d.cell.raw as { neg?: boolean } | undefined)?.neg) d.cell.styles.textColor = RED; };
  const heading = (text: string, y: number, room = 40) => {
    if (y > 200 - room) { doc.addPage(); y = 15; }
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY);
    doc.text(text, 10, y);
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
    return y + 3;
  };
  const t = report.totals;
  let y = 32;

  if (note?.trim()) {
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(note.trim(), 277) as string[];
    doc.text(lines, 10, y + 2);
    y += 2 + lines.length * 4.6 + 4;
  }

  autoTable(doc, {
    startY: y,
    head: [["Allocation", "PM Budget", "Net Cost", "Gross Cost", "Variance (Allocation - Net)", "% used"]],
    body: [[gbp(t.allocation), gbp(t.pm), gbp(t.net), gbp(t.gross), { content: gbp(t.variance), neg: t.variance < 0 }, pctUsed(t)]] as never,
    styles: { fontSize: 10, cellPadding: 3 }, headStyles: { fillColor: NAVY },
    didParseCell: redIfNegative, margin,
  });

  // Departments with their budget lines beneath
  y = heading("Budget by department and line", last() + 9);
  const body: unknown[][] = [];
  for (const d of report.departments) {
    body.push([{ content: d.name, styles: { fontStyle: "bold" } }, R(gbp(d.allocation)), R(money(d.pm)), R(money(d.net)), R(money(d.gross)), V(d.variance), R(pctUsed(d))].map(c => typeof c === "object" ? { ...c, styles: { ...(c as { styles?: object }).styles, fontStyle: "bold", fillColor: [236, 239, 247] } } : c));
    for (const l of d.lines)
      body.push([`    ${l.description}`, R(gbp(l.allocation)), R(money(l.pm)), R(money(l.net)), R(money(l.gross)), V(l.variance), R(pctUsed(l))]);
  }
  if (report.unlinkedHaulage.movements.length)
    body.push(["Haulage (not linked to a budget line)", R("–"), R(money(report.unlinkedHaulage.pm)), R(money(report.unlinkedHaulage.net)), R("–"), R("–"), R("–")]);
  if (report.contra.stops.length)
    body.push(["Venue contra", R("–"), R(money(report.contra.pm)), R(money(report.contra.net)), R("–"), R("–"), R("–")]);
  autoTable(doc, {
    startY: y,
    head: [["Department / line", R("Allocation"), R("PM Budget"), R("Net Cost"), R("Gross Cost"), R("Variance"), R("% used")]] as never,
    body: body as never,
    foot: [["TOTAL", R(gbp(t.allocation)), R(gbp(t.pm)), R(gbp(t.net)), R(gbp(t.gross)), V(t.variance), R(pctUsed(t))]] as never,
    styles: { fontSize: 9, cellPadding: 2.2 }, headStyles: { fillColor: NAVY },
    footStyles: { fillColor: [230, 233, 242], textColor: NAVY, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 95 } },
    didParseCell: redIfNegative, margin,
  });
  y = last() + 10;

  const variationTable = (title: string, list: ReportVariation[], approved: boolean) => {
    if (!list.length) return;
    y = heading(title, y);
    autoTable(doc, {
      startY: y,
      head: [["Date", "Title", "Type", "Lines affected", R("Change"), approved ? "Approved by" : "Requested by", "Client ref"]] as never,
      body: list.map(v => {
        const total = variationTotal(v);
        return [
          fmtDate((approved ? v.approvedAt : null) ?? v.requestedAt, ""), v.title + (v.justification ? `\n${v.justification}` : ""), VARIATION_TYPES[v.type] ?? v.type,
          v.items.map(i => `${i.budgetLine.department} — ${i.budgetLine.description}: ${i.amount >= 0 ? "+" : ""}${gbp(i.amount)}`).join("\n"),
          { content: Math.abs(total) < 0.005 ? "No net change" : `${total > 0 ? "+" : ""}${gbp(total)}`, neg: total < 0, styles: { halign: "right" } },
          (approved ? v.approvedBy?.name : v.requestedBy?.name) ?? "", v.clientRef ?? "",
        ];
      }) as never,
      styles: { fontSize: 8, cellPadding: 1.8 }, headStyles: { fillColor: NAVY },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 60 }, 3: { cellWidth: 85 } },
      didParseCell: redIfNegative, margin,
    });
    y = last() + 8;
  };
  variationTable("Approved budget variations", variations.filter(v => v.status === "approved"), true);
  variationTable("Variations awaiting your approval", variations.filter(v => v.status === "pending_approval"), false);

  const toInvoice = input.rechargeables.filter(m => m.rechargeable && !m.invoicedToClient);
  if (toInvoice.length) {
    y = heading("Rechargeables to be invoiced", y);
    const cost = (m: ReportMovement) => m.actualCost ?? m.estimatedCost ?? 0;
    autoTable(doc, {
      startY: y,
      head: [["Date", "Haulage company", "Route", "Cargo", R("Amount")]] as never,
      body: toInvoice.map(m => [fmtDate(m.departureAt, ""), m.haulageCompany, `${m.fromLocation} to ${m.toLocation}`, m.cargo ?? "",
        R(`${gbp(cost(m))}${m.actualCost == null ? " (est.)" : ""}`)]) as never,
      foot: [["", "Total", "", "", R(gbp(toInvoice.reduce((s, m) => s + cost(m), 0)))]] as never,
      styles: { fontSize: 8, cellPadding: 1.8 }, headStyles: { fillColor: NAVY },
      footStyles: { fillColor: [240, 242, 248], textColor: NAVY, fontStyle: "bold" }, margin,
    });
    y = last() + 8;
  }

  if (y > 185) { doc.addPage(); y = 15; }
  doc.setFontSize(7.5); doc.setTextColor(110, 110, 120);
  doc.text("PM Budget = estimated cost · Net Cost = committed · Gross Cost = spent · Variance = Allocation - Net Cost (red = over budget). Approved variations are included in the allocations.", 10, y + 2);
  doc.setTextColor(0, 0, 0);

  addFooters(doc);
  return doc;
}

export async function exportClientBudgetPDF(input: ClientReportInput, productionLogoUrl?: string | null) {
  const [logo, prodLogo] = await Promise.all([fetchLogoAsset(), productionLogoUrl ? fetchLogoAsset(productionLogoUrl) : Promise.resolve(null)]);
  buildClientBudgetPDF(input, logo, prodLogo ?? undefined).save(`budget-report-${slug(input.productionName)}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Excel ────────────────────────────────────────────────────────────────────
// Detail holds every figure; Lines and Summary add them up with formulas, so a figure changed in
// Detail flows through. Each formula also carries its value, for previewers that don't calculate.

const GBP_FMT = '£#,##0.00;[Red]-£#,##0.00;"–"';
const DATE_FMT = "d mmm yyyy";
const NOT_LINKED = "Not linked to a budget line";
type Cell = string | number | Date | null | { formula: string; result: number | string };

function styleSheet(ws: ExcelJS.Worksheet, headerRow: number, widths: number[], moneyCols: number[], dateCols: number[] = []) {
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  for (const c of moneyCols) ws.getColumn(c).numFmt = GBP_FMT;
  for (const c of dateCols) ws.getColumn(c).numFmt = DATE_FMT;
  ws.eachRow(row => row.eachCell(cell => { cell.font = { name: "Arial", size: 10, ...(cell.font?.bold ? { bold: true } : {}), ...(cell.font?.color ? { color: cell.font.color } : {}) }; }));
  const h = ws.getRow(headerRow);
  h.eachCell(cell => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A1941" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  ws.views = [{ state: "frozen", ySplit: headerRow }];
}
const boldRow = (ws: ExcelJS.Worksheet, r: number) => ws.getRow(r).eachCell(c => {
  c.font = { name: "Arial", size: 10, bold: true };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E9F2" } };
  c.border = { top: { style: "thin", color: { argb: "FF0A1941" } } };
});
const date = (s: string | null | undefined) => (s ? new Date(s) : null);
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

export function buildBudgetWorkbook(productionName: string, report: BudgetReport, variations: ReportVariation[], exportedAt = new Date()): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "PSG Hub";
  wb.created = exportedAt;
  wb.calcProperties.fullCalcOnLoad = true;
  const summary = wb.addWorksheet("Summary");
  const linesWs = wb.addWorksheet("Lines");
  const detail = wb.addWorksheet("Detail");
  const varWs = wb.addWorksheet("Variations");

  // Line names must be unique within a department for the formulas to add up correctly
  const lineName = new Map<number, string>();
  for (const d of report.departments) {
    const seen = new Map<string, number>();
    for (const l of d.lines) {
      const n = (seen.get(l.description) ?? 0) + 1;
      seen.set(l.description, n);
      lineName.set(l.id, n > 1 ? `${l.description} (${n})` : l.description);
    }
  }

  // Detail — one row per item. Columns: A Type, B Department, C Line, D Nominal, E Phase,
  // F Description, G Supplier, H PO, I Due, J PM, K Net, L Gross, M Status, N VAT exempt, O Method, P Notes
  const detailRows: Cell[][] = [];
  for (const d of report.departments) for (const l of d.lines) {
    const base = [d.name, lineName.get(l.id)!, l.nominalCode ?? ""];
    for (const x of l.items) detailRows.push(["Spend", ...base, phaseLabel(x.phase), x.description, x.supplier ?? "", x.poNumber ?? "", date(x.paymentDue), x.estimated, x.committed, x.spent, x.issuedForPayment ? "Issued" : "Pending", x.vatExempt ? "Yes" : "", "", x.notes ?? ""]);
    for (const m of l.movements) detailRows.push(["Haulage", ...base, "", `${m.haulageCompany}: ${m.fromLocation} → ${m.toLocation}${m.cargo ? ` (${m.cargo})` : ""}`, m.haulageCompany, "", date(m.departureAt), m.estimatedCost ?? null, m.actualCost ?? null, null, m.rechargeable ? "Rechargeable" : "", "", "", ""]);
    for (const x of l.psgItems) detailRows.push(["PSG expense", ...base, phaseLabel(x.phase), x.description, x.supplier ?? "", x.poNumber ?? "", date(x.paymentDue), null, x.committed, x.spent, "", "", x.paymentMethod ?? "", x.notes ?? ""]);
  }
  for (const m of report.unlinkedHaulage.movements)
    detailRows.push(["Haulage", "—", NOT_LINKED, "", "", `${m.fromLocation} → ${m.toLocation}${m.cargo ? ` (${m.cargo})` : ""}`, m.haulageCompany, "", date(m.departureAt), m.estimatedCost ?? null, m.actualCost ?? null, null, m.rechargeable ? "Rechargeable" : "", "", "", ""]);
  for (const s of report.contra.stops)
    detailRows.push(["Venue contra", "—", `Stop ${s.stopNumber}`, "", "", `${s.venue.name}${s.venue.city ? `, ${s.venue.city}` : ""}`, "", "", null, s.contraEstimate ?? null, s.contraActual ?? null, null, "", "", "", ""]);
  detail.addRow(["Type", "Department", "Line", "Nominal code", "Phase", "Description", "Supplier", "PO number", "Payment due", "PM Budget", "Net Cost", "Gross Cost", "Status", "VAT exempt", "Payment method", "Notes"]);
  detailRows.forEach(r => detail.addRow(r));
  const dLast = Math.max(2, detailRows.length + 1);
  const D = (col: string) => `Detail!$${col}$2:$${col}$${dLast}`;
  styleSheet(detail, 1, [13, 20, 28, 12, 15, 40, 22, 14, 13, 13, 13, 13, 13, 10, 16, 40], [10, 11, 12], [9]);
  detail.autoFilter = { from: "A1", to: `P${dLast}` };

  // Lines — one row per budget line, figures added up from Detail
  linesWs.addRow(["Department", "Line", "Nominal code", "Allocation", "PM Budget", "Net Cost", "Gross Cost", "Variance", "% used", "Notes"]);
  let r = 2;
  const deptLineRows = new Map<string, number[]>();
  for (const d of report.departments) for (const l of d.lines) {
    const match = `(${D("B")}=$A${r})*(${D("C")}=$B${r})`;
    linesWs.addRow([
      d.name, lineName.get(l.id)!, l.nominalCode ?? "", l.allocation,
      { formula: `SUMPRODUCT(${match}*${D("J")})`, result: l.pm },
      { formula: `SUMPRODUCT(${match}*${D("K")})`, result: l.net },
      { formula: `SUMPRODUCT(${match}*${D("L")})`, result: l.gross },
      { formula: `D${r}-F${r}`, result: l.variance },
      { formula: `IF(D${r}=0,"",F${r}/D${r})`, result: l.allocation ? l.net / l.allocation : "" },
      l.notes ?? "",
    ] as Cell[]);
    deptLineRows.set(d.name, [...(deptLineRows.get(d.name) ?? []), r]);
    r++;
  }
  const lLast = Math.max(2, r - 1);
  const L = (col: string) => `Lines!$${col}$2:$${col}$${lLast}`;
  styleSheet(linesWs, 1, [22, 32, 13, 14, 14, 14, 14, 14, 9, 40], [4, 5, 6, 7, 8]);
  linesWs.getColumn(9).numFmt = "0%";
  linesWs.autoFilter = { from: "A1", to: `J${lLast}` };

  // Summary — by department, plus unlinked haulage and contra, with totals
  summary.addRow([`Budget — ${productionName}`]);
  summary.addRow([`Exported ${fmtDate(exportedAt.toISOString())} from PSG Hub`]);
  summary.addRow([]);
  summary.addRow(["Department", "Allocation", "PM Budget", "Net Cost", "Gross Cost", "Variance", "% used"]);
  const first = 5;
  r = first;
  const sumRow = (label: string, f: { alloc?: string; pm: string; net: string; gross?: string }, v: { allocation?: number; pm: number; net: number; gross?: number }) => {
    const hasAlloc = f.alloc != null;
    summary.addRow([
      label,
      hasAlloc ? { formula: f.alloc!, result: v.allocation! } : null,
      { formula: f.pm, result: v.pm },
      { formula: f.net, result: v.net },
      f.gross ? { formula: f.gross, result: v.gross! } : null,
      hasAlloc ? { formula: `B${r}-D${r}`, result: v.allocation! - v.net } : null,
      hasAlloc ? { formula: `IF(B${r}=0,"",D${r}/B${r})`, result: v.allocation ? v.net / v.allocation : "" } : null,
    ] as Cell[]);
    r++;
  };
  for (const d of report.departments) {
    const m = `(${L("A")}=${q(d.name)})`;
    sumRow(d.name, { alloc: `SUMPRODUCT(${m}*${L("D")})`, pm: `SUMPRODUCT(${m}*${L("E")})`, net: `SUMPRODUCT(${m}*${L("F")})`, gross: `SUMPRODUCT(${m}*${L("G")})` }, d);
  }
  if (report.unlinkedHaulage.movements.length) {
    const m = `(${D("A")}="Haulage")*(${D("C")}=${q(NOT_LINKED)})`;
    sumRow("Haulage (not linked to a line)", { pm: `SUMPRODUCT(${m}*${D("J")})`, net: `SUMPRODUCT(${m}*${D("K")})` }, report.unlinkedHaulage);
  }
  if (report.contra.stops.length) {
    const m = `(${D("A")}="Venue contra")`;
    sumRow("Venue contra", { pm: `SUMPRODUCT(${m}*${D("J")})`, net: `SUMPRODUCT(${m}*${D("K")})` }, report.contra);
  }
  const lastBody = r - 1;
  const t = report.totals;
  const col = (c: string) => (lastBody >= first ? `SUM(${c}${first}:${c}${lastBody})` : "0");
  summary.addRow([
    "TOTAL",
    { formula: col("B"), result: t.allocation }, { formula: col("C"), result: t.pm }, { formula: col("D"), result: t.net },
    { formula: col("E"), result: t.gross }, { formula: `B${r}-D${r}`, result: t.variance },
    { formula: `IF(B${r}=0,"",D${r}/B${r})`, result: t.allocation ? t.net / t.allocation : "" },
  ] as Cell[]);
  const totalRow = r;
  summary.addRow([]);
  summary.addRow(["PM Budget = estimated cost · Net Cost = committed · Gross Cost = spent · Variance = Allocation − Net Cost (red = over budget)."]);
  summary.addRow(["Haulage counts towards the line it is linked to (estimate in PM Budget, actual in Net Cost). Approved variations are already included in each line's allocation."]);
  summary.addRow(["Lines and Summary are formulas over the Detail sheet, so changing a figure in Detail updates the totals."]);
  styleSheet(summary, 4, [34, 15, 15, 15, 15, 15, 9], [2, 3, 4, 5, 6]);
  summary.getColumn(7).numFmt = "0%";
  boldRow(summary, totalRow);
  summary.getCell("A1").font = { name: "Arial", size: 14, bold: true, color: { argb: "FF0A1941" } };
  summary.getCell("A2").font = { name: "Arial", size: 9, color: { argb: "FF666666" } };
  for (let i = totalRow + 2; i <= totalRow + 4; i++) summary.getCell(`A${i}`).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF666666" } };

  // Variations — one row per line affected
  varWs.addRow(["Requested", "Title", "Type", "Status", "Department", "Line", "Change", "Item note", "Requested by", "Decided by", "Decided on", "Client ref", "Justification", "Rejection reason"]);
  for (const v of variations) {
    const items = v.items.length ? v.items : [null];
    for (const i of items)
      varWs.addRow([
        date(v.requestedAt), v.title, VARIATION_TYPES[v.type] ?? v.type, VARIATION_STATUSES[v.status] ?? v.status,
        i?.budgetLine.department ?? "", i?.budgetLine.description ?? "", i?.amount ?? null, i?.note ?? "",
        v.requestedBy?.name ?? "", decidedBy(v), v.status === "approved" ? date(v.approvedAt) : null, v.clientRef ?? "", v.justification ?? "", v.rejectionReason ?? "",
      ] as Cell[]);
  }
  if (!variations.length) varWs.addRow(["", "No budget variations"]);
  styleSheet(varWs, 1, [13, 30, 16, 16, 20, 28, 13, 30, 18, 18, 13, 14, 40, 30], [7], [1, 11]);
  if (variations.length) varWs.autoFilter = { from: "A1", to: `N${varWs.rowCount}` };

  return wb;
}

export async function exportBudgetXLSX(productionName: string, report: BudgetReport, variations: ReportVariation[]) {
  await saveXlsx(buildBudgetWorkbook(productionName, report, variations), `budget-${slug(productionName)}.xlsx`);
}
