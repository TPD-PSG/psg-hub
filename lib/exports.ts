import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

type LogoAsset = { dataUrl: string; w: number; h: number } | null;

async function fetchLogoAsset(): Promise<LogoAsset> {
  try {
    const res = await fetch("/psg-logo.png");
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    const { w, h } = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { dataUrl, w, h };
  } catch {
    return null;
  }
}

function basePDF(title: string, subtitle?: string, logo?: LogoAsset): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFillColor(10, 25, 65);
  doc.rect(0, 0, 297, 20, "F");

  let textX = 10;
  if (logo) {
    // Fit logo into the 16mm tall space (2mm padding each side) preserving aspect ratio
    const maxH = 16;
    const maxW = 40;
    const aspect = logo.w / logo.h;
    let lh = maxH;
    let lw = lh * aspect;
    if (lw > maxW) { lw = maxW; lh = lw / aspect; }
    const ly = 2 + (maxH - lh) / 2;
    doc.addImage(logo.dataUrl, "PNG", 4, ly, lw, lh);
    textX = 4 + lw + 3;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Production Solutions Group", textX, 13);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(title, 297 - 10, 13, { align: "right" });
  if (subtitle) {
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    doc.text(subtitle, 10, 27);
  }
  doc.setTextColor(0, 0, 0);
  return doc;
}

// ── Budget ───────────────────────────────────────────────────────────────────

type Expense = { phase: string; description: string; estimated: number; committed: number; spent: number; supplier: string | null; poNumber: string | null; paymentDue: string | null; issuedForPayment: boolean; vatExempt: boolean; notes: string | null };
type BudgetLine = { department: string; description: string; budgeted: number; expenses: Expense[] };

export async function exportBudgetPDF(productionName: string, lines: BudgetLine[]) {
  const logo = await fetchLogoAsset();
  const doc = basePDF(`Budget — ${productionName}`, `Exported ${fmtDate(new Date().toISOString())}`, logo);
  let y = 32;

  const totEst = lines.reduce((s, l) => s + l.expenses.reduce((e, x) => e + x.estimated, 0), 0);
  const totCom = lines.reduce((s, l) => s + l.expenses.reduce((e, x) => e + x.committed, 0), 0);
  const totSpt = lines.reduce((s, l) => s + l.expenses.reduce((e, x) => e + x.spent, 0), 0);
  const totBud = lines.reduce((s, l) => s + l.budgeted, 0);

  // Summary row
  autoTable(doc, {
    startY: y,
    head: [["Allocation", "Estimated", "Committed", "Spent"]],
    body: [[fmtGBP(totBud), fmtGBP(totEst), fmtGBP(totCom), fmtGBP(totSpt)]],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [10, 25, 65] },
    margin: { left: 10, right: 10 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Department breakdown
  for (const line of lines) {
    if (y > 185) { doc.addPage(); y = 15; }
    autoTable(doc, {
      startY: y,
      head: [[{ content: `${line.department} — ${line.description}  (Allocation: ${fmtGBP(line.budgeted)})`, colSpan: 7, styles: { fillColor: [30, 50, 100], textColor: 255 } }],
        ["Phase", "Description", "Supplier", "PO", "Estimated", "Committed", "Spent"]],
      body: line.expenses.length
        ? line.expenses.map((x) => [x.phase, x.description, x.supplier ?? "", x.poNumber ?? "", fmtGBP(x.estimated), fmtGBP(x.committed), fmtGBP(x.spent)])
        : [["", "No items", "", "", "", "", ""]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 25, 65] },
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
      margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  doc.save(`budget-${productionName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

export function exportBudgetXLSX(productionName: string, lines: BudgetLine[]) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows = [
    ["Department", "Description", "Allocation", "Estimated", "Committed", "Spent"],
    ...lines.map((l) => [
      l.department, l.description, l.budgeted,
      l.expenses.reduce((s, x) => s + x.estimated, 0),
      l.expenses.reduce((s, x) => s + x.committed, 0),
      l.expenses.reduce((s, x) => s + x.spent, 0),
    ]),
    ["", "TOTAL",
      lines.reduce((s, l) => s + l.budgeted, 0),
      lines.reduce((s, l) => s + l.expenses.reduce((e, x) => e + x.estimated, 0), 0),
      lines.reduce((s, l) => s + l.expenses.reduce((e, x) => e + x.committed, 0), 0),
      lines.reduce((s, l) => s + l.expenses.reduce((e, x) => e + x.spent, 0), 0),
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

  // Detail sheet
  const detailRows = [
    ["Department", "Line", "Phase", "Description", "Supplier", "PO Number", "Payment Due", "Estimated", "Committed", "Spent", "Issued", "VAT Exempt", "Notes"],
    ...lines.flatMap((l) =>
      l.expenses.map((x) => [
        l.department, l.description, x.phase, x.description, x.supplier ?? "", x.poNumber ?? "",
        x.paymentDue ? fmtDate(x.paymentDue) : "",
        x.estimated, x.committed, x.spent,
        x.issuedForPayment ? "Yes" : "No", x.vatExempt ? "Yes" : "No", x.notes ?? "",
      ])
    ),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), "Detail");

  XLSX.writeFile(wb, `budget-${productionName.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
}

// ── Schedule ─────────────────────────────────────────────────────────────────

type ScheduleEvent = { title: string; type: string; startAt: string; endAt: string; location: string | null; notes: string | null };

export async function exportSchedulePDF(productionName: string, events: ScheduleEvent[]) {
  const logo = await fetchLogoAsset();
  const doc = basePDF(`Schedule — ${productionName}`, `Exported ${fmtDate(new Date().toISOString())}`, logo);
  autoTable(doc, {
    startY: 32,
    head: [["Date", "Start", "End", "Title", "Type", "Location", "Notes"]],
    body: events.map((e) => [
      fmtDate(e.startAt),
      new Date(e.startAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      new Date(e.endAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      e.title, e.type, e.location ?? "", e.notes ?? "",
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [10, 25, 65] },
    margin: { left: 10, right: 10 },
  });
  doc.save(`schedule-${productionName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

export function exportScheduleXLSX(productionName: string, events: ScheduleEvent[]) {
  const rows = [
    ["Date", "Start", "End", "Title", "Type", "Location", "Notes"],
    ...events.map((e) => [
      fmtDate(e.startAt),
      new Date(e.startAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      new Date(e.endAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      e.title, e.type, e.location ?? "", e.notes ?? "",
    ]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Schedule");
  XLSX.writeFile(wb, `schedule-${productionName.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
}

// ── Crew ─────────────────────────────────────────────────────────────────────

type CrewRow = { name: string; discipline: string; phone: string | null; email: string | null; company: string | null; isFreelance: boolean; insuranceProvider: string | null; insurancePolicyNo: string | null; insuranceExpiry: string | null; insuranceCoverType: string | null };

export async function exportCrewPDF(title: string, crew: CrewRow[]) {
  const logo = await fetchLogoAsset();
  const doc = basePDF(`Crew — ${title}`, `Exported ${fmtDate(new Date().toISOString())}`, logo);
  autoTable(doc, {
    startY: 32,
    head: [["Name", "Discipline", "Freelance", "Phone", "Email", "Company", "Ins. Provider", "Policy No.", "Expiry", "Cover Type"]],
    body: crew.map((c) => [
      c.name, c.discipline, c.isFreelance ? "Yes" : "No",
      c.phone ?? "", c.email ?? "", c.company ?? "",
      c.insuranceProvider ?? "", c.insurancePolicyNo ?? "",
      c.insuranceExpiry ? fmtDate(c.insuranceExpiry) : "",
      c.insuranceCoverType ?? "",
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [10, 25, 65] },
    margin: { left: 10, right: 10 },
  });
  doc.save(`crew-${title.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

export function exportCrewXLSX(title: string, crew: CrewRow[]) {
  const rows = [
    ["Name", "Discipline", "Freelance", "Phone", "Email", "Company", "Insurance Provider", "Policy No.", "Insurance Expiry", "Cover Type"],
    ...crew.map((c) => [
      c.name, c.discipline, c.isFreelance ? "Yes" : "No",
      c.phone ?? "", c.email ?? "", c.company ?? "",
      c.insuranceProvider ?? "", c.insurancePolicyNo ?? "",
      c.insuranceExpiry ? fmtDate(c.insuranceExpiry) : "",
      c.insuranceCoverType ?? "",
    ]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Crew");
  XLSX.writeFile(wb, `crew-${title.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
}

// ── Accommodation ────────────────────────────────────────────────────────────

type BookingRow = { hotel: { name: string; city: string | null }; crew: { name: string; discipline: string } | null; guestName: string | null; roomType: string | null; roomNumber: string | null; checkIn: string; checkOut: string; ratePerNight: number | null; totalCost: number | null; confirmationNo: string | null; isPaid: boolean; notes: string | null };

export async function exportAccommodationPDF(productionName: string, bookings: BookingRow[]) {
  const logo = await fetchLogoAsset();
  const doc = basePDF(`Accommodation — ${productionName}`, `Exported ${fmtDate(new Date().toISOString())}`, logo);
  autoTable(doc, {
    startY: 32,
    head: [["Guest", "Hotel", "Room Type", "Room No.", "Check In", "Check Out", "Nights", "Total", "Ref", "Paid"]],
    body: bookings.map((b) => {
      const nights = Math.round((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / 86400000);
      const cost = b.totalCost ?? (b.ratePerNight ? b.ratePerNight * nights : null);
      return [
        b.crew ? b.crew.name : (b.guestName || "Unassigned"),
        `${b.hotel.name}${b.hotel.city ? ` (${b.hotel.city})` : ""}`,
        b.roomType ?? "", b.roomNumber ?? "",
        fmtDate(b.checkIn), fmtDate(b.checkOut), String(nights),
        cost ? fmtGBP(cost) : "", b.confirmationNo ?? "",
        b.isPaid ? "Yes" : "No",
      ];
    }),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [10, 25, 65] },
    margin: { left: 10, right: 10 },
  });
  doc.save(`accommodation-${productionName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

export function exportAccommodationXLSX(productionName: string, bookings: BookingRow[]) {
  const rows = [
    ["Guest", "Hotel", "City", "Room Type", "Room No.", "Check In", "Check Out", "Nights", "Rate/Night", "Total Cost", "Confirmation Ref", "Paid", "Notes"],
    ...bookings.map((b) => {
      const nights = Math.round((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / 86400000);
      return [
        b.crew ? b.crew.name : (b.guestName || "Unassigned"),
        b.hotel.name, b.hotel.city ?? "",
        b.roomType ?? "", b.roomNumber ?? "",
        fmtDate(b.checkIn), fmtDate(b.checkOut), nights,
        b.ratePerNight ?? "", b.totalCost ?? (b.ratePerNight ? b.ratePerNight * nights : ""),
        b.confirmationNo ?? "", b.isPaid ? "Yes" : "No", b.notes ?? "",
      ];
    }),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Accommodation");
  XLSX.writeFile(wb, `accommodation-${productionName.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
}

// ── Haulage ──────────────────────────────────────────────────────────────────

type MovementRow = { haulageCompany: string; fromLocation: string; toLocation: string; departureAt: string; arrivalAt: string | null; driverName: string | null; vehicleInfo: string | null; cargo: string | null; notes: string | null; production?: { name: string } };

export async function exportHaulagePDF(title: string, movements: MovementRow[], includeProduction = false) {
  const logo = await fetchLogoAsset();
  const doc = basePDF(`Haulage — ${title}`, `Exported ${fmtDate(new Date().toISOString())}`, logo);
  const head = includeProduction
    ? [["Production", "Company", "From", "To", "Departure", "Arrival", "Driver", "Vehicle", "Cargo"]]
    : [["Company", "From", "To", "Departure", "Arrival", "Driver", "Vehicle", "Cargo"]];
  const body = movements.map((m) => {
    const row = [m.haulageCompany, m.fromLocation, m.toLocation, fmtDateTime(m.departureAt), m.arrivalAt ? fmtDateTime(m.arrivalAt) : "", m.driverName ?? "", m.vehicleInfo ?? "", m.cargo ?? ""];
    return includeProduction ? [m.production?.name ?? "", ...row] : row;
  });
  autoTable(doc, {
    startY: 32,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [10, 25, 65] },
    margin: { left: 10, right: 10 },
  });
  doc.save(`haulage-${title.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

export function exportHaulageXLSX(title: string, movements: MovementRow[], includeProduction = false) {
  const headers = includeProduction
    ? ["Production", "Company", "From", "To", "Departure", "Arrival", "Driver", "Vehicle", "Cargo", "Notes"]
    : ["Company", "From", "To", "Departure", "Arrival", "Driver", "Vehicle", "Cargo", "Notes"];
  const rows = [
    headers,
    ...movements.map((m) => {
      const row = [m.haulageCompany, m.fromLocation, m.toLocation, fmtDateTime(m.departureAt), m.arrivalAt ? fmtDateTime(m.arrivalAt) : "", m.driverName ?? "", m.vehicleInfo ?? "", m.cargo ?? "", m.notes ?? ""];
      return includeProduction ? [m.production?.name ?? "", ...row] : row;
    }),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Haulage");
  XLSX.writeFile(wb, `haulage-${title.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
}

// ── Tour Schedule ─────────────────────────────────────────────────────────────

type TourStopRow = { stopNumber: number; venue: { name: string; city: string | null; capacity: number | null } | null; loadInDate: string | null; performanceStart: string | null; performanceEnd: string | null; endDate: string | null; notes: string | null };

export async function exportTourSchedulePDF(productionName: string, stops: TourStopRow[]) {
  const logo = await fetchLogoAsset();
  const doc = basePDF(`Tour Schedule — ${productionName}`, `Exported ${fmtDate(new Date().toISOString())}`, logo);
  autoTable(doc, {
    startY: 32,
    head: [["Stop", "Venue", "City", "Capacity", "Load In", "First Performance", "Last Performance", "Get Out", "Notes"]],
    body: stops.map((s) => [
      String(s.stopNumber),
      s.venue?.name ?? "",
      s.venue?.city ?? "",
      s.venue?.capacity != null ? String(s.venue.capacity) : "",
      s.loadInDate ? fmtDate(s.loadInDate) : "",
      s.performanceStart ? fmtDate(s.performanceStart) : "",
      s.performanceEnd ? fmtDate(s.performanceEnd) : "",
      s.endDate ? fmtDate(s.endDate) : "",
      s.notes ?? "",
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [10, 25, 65] },
    columnStyles: { 0: { halign: "center", cellWidth: 12 }, 3: { halign: "right" } },
    margin: { left: 10, right: 10 },
  });
  doc.save(`tour-schedule-${productionName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

export function exportTourScheduleXLSX(productionName: string, stops: TourStopRow[]) {
  const rows = [
    ["Stop", "Venue", "City", "Capacity", "Load In", "First Performance", "Last Performance", "Get Out", "Notes"],
    ...stops.map((s) => [
      s.stopNumber,
      s.venue?.name ?? "",
      s.venue?.city ?? "",
      s.venue?.capacity ?? "",
      s.loadInDate ? fmtDate(s.loadInDate) : "",
      s.performanceStart ? fmtDate(s.performanceStart) : "",
      s.performanceEnd ? fmtDate(s.performanceEnd) : "",
      s.endDate ? fmtDate(s.endDate) : "",
      s.notes ?? "",
    ]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Tour Schedule");
  XLSX.writeFile(wb, `tour-schedule-${productionName.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
}
