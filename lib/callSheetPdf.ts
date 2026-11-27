// The call sheet PDF (A4 landscape, PSG header like the other exports): the day's schedule, the
// notes, then everyone's call in one list by call time. Made in the browser, then downloaded or
// handed to the server to email.
import { addFooters, autoTable, basePDF, fetchLogoAsset } from "@/lib/exports";
import { byCallTime } from "@/lib/callSheetTimes";

type WithAutoTable = ReturnType<typeof basePDF> & { lastAutoTable: { finalY: number } };

export type CallSheetForPdf = {
  date: string; title: string | null; venue: string | null; generalNotes: string | null;
  schedule: { title: string; type: string; startAt: string; endAt: string; location: string | null }[];
  entries: { discipline: string; name: string | null; role: string | null; callTime: string | null; notes: string | null }[];
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const longDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

async function build(productionName: string, sheet: CallSheetForPdf, opts: { updated?: boolean; productionLogoUrl?: string | null }) {
  const [logo, prodLogo] = await Promise.all([fetchLogoAsset(), opts.productionLogoUrl ? fetchLogoAsset(opts.productionLogoUrl) : Promise.resolve(null)]);
  const doc = basePDF(`Call sheet — ${productionName}`, undefined, logo, prodLogo ?? undefined) as WithAutoTable;
  let y = 30;
  if (opts.updated) {
    doc.setFillColor(220, 38, 38);
    doc.roundedRect(10, y - 5, 30, 7, 1, 1, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("UPDATED", 25, y - 0.4, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 6;
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text(longDay(sheet.date), 10, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(70, 70, 90);
  const sub = [sheet.title, sheet.venue].filter(Boolean).join("  ·  ");
  if (sub) doc.text(sub, 10, y + 6);
  doc.setTextColor(0, 0, 0);
  y += sub ? 12 : 6;

  if (sheet.schedule.length) {
    autoTable(doc, {
      startY: y,
      head: [["Schedule", "From", "To", "Where"]],
      body: sheet.schedule.map(e => [e.title, time(e.startAt), time(e.endAt), e.location ?? ""]),
      styles: { fontSize: 9, cellPadding: 1.8 },
      headStyles: { fillColor: [10, 25, 65] },
      columnStyles: { 1: { cellWidth: 20 }, 2: { cellWidth: 20 } },
      margin: { left: 10, right: 10 },
    });
    y = doc.lastAutoTable.finalY + 6;
  }
  if (sheet.generalNotes?.trim()) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Notes", 10, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const lines = doc.splitTextToSize(sheet.generalNotes.trim(), 277);
    doc.text(lines, 10, y + 5);
    y += 5 + lines.length * 4 + 4;
  }
  const rows = byCallTime(sheet.entries);
  autoTable(doc, {
    startY: y,
    head: [["Call", "Name", "Department", "Role", "Notes"]],
    body: rows.map(r => [r.callTime ?? "TBC", r.name ?? `All ${r.discipline}`, r.discipline, r.role ?? "", r.notes ?? ""]),
    styles: { fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: [10, 25, 65] },
    columnStyles: { 0: { cellWidth: 18, fontStyle: "bold" } },
    margin: { left: 10, right: 10 },
  });
  addFooters(doc);
  return doc;
}

const fileName = (productionName: string, sheet: CallSheetForPdf, updated?: boolean) =>
  `call-sheet-${productionName}-${sheet.date.slice(0, 10)}${updated ? "-updated" : ""}.pdf`.replace(/[^A-Za-z0-9.-]+/g, "-").toLowerCase();

export async function downloadCallSheetPDF(productionName: string, sheet: CallSheetForPdf, opts: { updated?: boolean; productionLogoUrl?: string | null } = {}) {
  (await build(productionName, sheet, opts)).save(fileName(productionName, sheet, opts.updated));
}
/** The PDF as base64, for emailing. */
export async function callSheetPdfBase64(productionName: string, sheet: CallSheetForPdf, opts: { updated?: boolean; productionLogoUrl?: string | null } = {}) {
  const uri = (await build(productionName, sheet, opts)).output("datauristring");
  return uri.slice(uri.indexOf(",") + 1);
}
