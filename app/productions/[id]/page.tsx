"use client";

import { useEffect, useState, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import ExportMenu from "@/components/ExportMenu";
import TasksPanel from "@/components/TasksPanel";
import { exportBudgetPDF, exportBudgetXLSX, exportSchedulePDF, exportScheduleXLSX, exportCrewPDF, exportCrewXLSX, exportAccommodationPDF, exportAccommodationXLSX, exportHaulagePDF, exportHaulageXLSX, exportTourSchedulePDF, exportTourScheduleXLSX, exportVenueStopPDF, exportContactSheetPDF } from "@/lib/exports";

type SpendDoc = { id: number; type: string; name: string; mime: string; invoiceDate: string | null; invoiceAmount: number | null; invoiceNumber: string | null; issuedForPayment: boolean; createdAt: string };
type Expense = {
  id: number;
  phase: string;
  description: string;
  estimated: number;
  committed: number;
  spent: number;
  poNumber: string | null;
  paymentDue: string | null;
  issuedForPayment: boolean;
  vatExempt: boolean;
  supplier: string | null;
  notes: string | null;
  approvedBy: string | null;
  approvedDate: string | null;
  approvalMethod: string | null;
  isPSGExpense: boolean;
  paymentMethod: string | null;
  documents: SpendDoc[];
};
type BudgetLine = {
  id: number;
  department: string;
  description: string;
  nominalCode: string | null;
  budgeted: number;
  notes: string | null;
  expenses: Expense[];
};
type HotelInfo = { id: number; name: string; city: string | null };
type HotelBooking = {
  id: number;
  hotelId: number;
  hotel: HotelInfo;
  crewId: number | null;
  crew: CrewMember | null;
  guestName: string | null;
  roomType: string | null;
  roomNumber: string | null;
  checkIn: string;
  checkOut: string;
  ratePerNight: number | null;
  totalCost: number | null;
  confirmationNo: string | null;
  isPaid: boolean;
  notes: string | null;
};
type CrewMember = {
  id: number;
  name: string;
  discipline: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  isFreelance: boolean;
  insuranceProvider: string | null;
  insurancePolicyNo: string | null;
  insuranceExpiry: string | null;
  insuranceCoverType: string | null;
};
type ProductionCrew = {
  id: number;
  crewId: number;
  crew: CrewMember;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  dayRate: number | null;
  notes: string | null;
};
type Event = {
  id: number;
  title: string;
  type: string;
  startAt: string;
  endAt: string;
  location: string | null;
  notes: string | null;
};
type HaulageMovement = {
  id: number;
  haulageCompany: string;
  driverName: string | null;
  vehicleInfo: string | null;
  fromLocation: string;
  toLocation: string;
  departureAt: string;
  arrivalAt: string | null;
  cargo: string | null;
  notes: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  rechargeable: boolean;
  budgetLineId: number | null;
};
type TeamMember = { user: { id: number; name: string; email: string; role: string } };
type VenueRef = { id: number; name: string; city: string | null; capacity: number | null };
type TourStop = { id: number; venueId: number; venue: VenueRef; stopNumber: number; advancingStatus: string; contraEstimate: number | null; contraActual: number | null; loadInDate: string | null; startDate: string | null; endDate: string | null; performanceStart: string | null; performanceEnd: string | null; notes: string | null };
type Production = {
  id: number;
  name: string;
  logoUrl: string | null;
  type: string;
  venue: string | null;
  venueId: number | null;
  venueRef: VenueRef | null;
  isTour: boolean;
  startDate: string | null;
  endDate: string | null;
  status: string;
  announcementStatus: string;
  color: string | null;
  notes: string | null;
  reportEmail: string | null;
  sharepointUrl: string | null;
  haulageBudgetLineId: number | null;
  events: Event[];
  budgetLines: BudgetLine[];
  crew: ProductionCrew[];
  hotelBookings: HotelBooking[];
  haulageMovements: HaulageMovement[];
  team: TeamMember[];
};

type KeyDate = { id: number; type: string; label: string | null; startDate: string; endDate: string | null; notes: string | null };

const KEY_DATE_TYPES: { value: string; label: string }[] = [
  { value: "design_presentation", label: "Design Presentation" },
  { value: "pre_production", label: "Pre-Production" },
  { value: "first_rehearsal", label: "First Rehearsal" },
  { value: "rehearsal_period", label: "Rehearsal Period" },
  { value: "load_in", label: "Load In" },
  { value: "fit_up", label: "Fit Up" },
  { value: "technical_rehearsal", label: "Technical Rehearsal" },
  { value: "dress_rehearsal", label: "Dress Rehearsal" },
  { value: "preview", label: "Preview" },
  { value: "press_night", label: "Press Night" },
  { value: "performance", label: "Performance" },
  { value: "get_out", label: "Get Out" },
  { value: "other", label: "Other" },
];
const KEY_DATE_LABEL: Record<string, string> = Object.fromEntries(KEY_DATE_TYPES.map(t => [t.value, t.label]));

const EVENT_TYPES = ["Rehearsal", "Tech", "Dress Rehearsal", "Performance", "Meeting", "Workshop", "Other"];
const DEPARTMENTS = ["Scenery", "Props", "Wardrobe", "Wigs & Hair", "Makeup", "Sound Hires", "Sound Consumables", "Lighting Hires", "Lighting Consumables", "Rigging", "Instruments", "Video Hires", "Video Consumables", "Video Content", "Production Setup", "Transport", "Rehearsal", "Production Staffing", "Petty Cash", "Other"];
const PHASES = ["Capitalisation", "running", "closing"];
const STATUS_OPTS = ["planning", "in-production", "closed"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function fmtShortDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const EVENT_COLORS: Record<string, string> = {
  Rehearsal: "bg-blue-900/70 text-blue-300",
  Tech: "bg-purple-900/70 text-purple-300",
  "Dress Rehearsal": "bg-indigo-900/70 text-indigo-300",
  Performance: "bg-green-900/70 text-green-300",
  Meeting: "bg-yellow-900/70 text-yellow-300",
  Workshop: "bg-orange-900/70 text-orange-300",
  Other: "bg-white/10 text-white/60",
};

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-yellow-900/60 text-yellow-300",
  "in-production": "bg-green-900/60 text-green-300",
  closed: "bg-white/10 text-white/40",
};

const ANN_COLORS: Record<string, string> = {
  nda: "bg-red-900/60 text-red-300",
  not_announced: "bg-orange-900/50 text-orange-300",
  on_sale: "bg-blue-900/60 text-blue-300",
  open: "bg-green-900/60 text-green-300",
};
const ANN_LABELS: Record<string, string> = {
  nda: "NDA", not_announced: "Not Announced", on_sale: "On Sale", open: "Open",
};
const ANN_OPTS = ["nda", "not_announced", "on_sale", "open"];

const PHASE_COLORS: Record<string, string> = {
  "Capitalisation": "text-yellow-400",
  running: "text-green-400",
  closing: "text-blue-400",
};

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

const BLANK_EXPENSE = { phase: "Capitalisation", description: "", estimated: "", committed: "", spent: "", poNumber: "", paymentDue: "", issuedForPayment: false, vatExempt: false, supplier: "", notes: "", approvedBy: "", approvedDate: "", approvalMethod: "", isPSGExpense: false, paymentMethod: "" };
const BLANK_PSG_EXPENSE = { description: "", supplier: "", committed: "", spent: "", paymentDue: "", notes: "", paymentMethod: "" };

type TabKey = "schedule" | "budget" | "crew" | "accommodation" | "haulage" | "callsheets" | "advancing" | "contacts" | "reports" | "tasks" | "tour";

function ProductionPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prod, setProd] = useState<Production | null>(null);
  const tab: TabKey = (searchParams.get("section") as TabKey) ?? "schedule";
  const BLANK_KD = { type: "first_rehearsal", label: "", startDate: "", endDate: "", notes: "" };
  const [keyDates, setKeyDates] = useState<KeyDate[]>([]);
  const [showKdForm, setShowKdForm] = useState(false);
  const [editKd, setEditKd] = useState<KeyDate | null>(null);
  const [kdForm, setKdForm] = useState(BLANK_KD);
  const BLANK_MOVEMENT = { haulageCompany: "", driverName: "", vehicleInfo: "", fromLocation: "", toLocation: "", departureAt: "", arrivalAt: "", cargo: "", notes: "", estimatedCost: "", actualCost: "", rechargeable: false, budgetLineId: "" };
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [editMovement, setEditMovement] = useState<HaulageMovement | null>(null);
  const [movementForm, setMovementForm] = useState<typeof BLANK_MOVEMENT & { id?: number }>(BLANK_MOVEMENT);
  const [allCrew, setAllCrew] = useState<CrewMember[]>([]);
  const [showCrewForm, setShowCrewForm] = useState(false);
  const [crewForm, setCrewForm] = useState({ crewId: "", role: "", startDate: "", endDate: "", dayRate: "", notes: "" });
  const [allHotels, setAllHotels] = useState<HotelInfo[]>([]);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [editBooking, setEditBooking] = useState<HotelBooking | null>(null);
  const BLANK_BOOKING = { hotelId: "", crewId: "", guestName: "", roomType: "", roomNumber: "", checkIn: "", checkOut: "", ratePerNight: "", totalCost: "", confirmationNo: "", isPaid: false, notes: "" };
  const [bookingForm, setBookingForm] = useState<typeof BLANK_BOOKING & { id?: number }>(BLANK_BOOKING);
  const [budgetView, setBudgetView] = useState<"summary" | "detail">("detail");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Spend document state
  type PendingInvoice = { file: File; invoiceDate: string; invoiceAmount: string; invoiceNumber: string; issuedForPayment: boolean; extracting?: boolean };
  const [existingDocs, setExistingDocs] = useState<SpendDoc[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<File[]>([]);
  const [pendingPO, setPendingPO] = useState<File[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [docsUploading, setDocsUploading] = useState(false);
  const [invoiceDragOver, setInvoiceDragOver] = useState(false);
  const [quoteDragOver, setQuoteDragOver] = useState(false);

  const [allUsers, setAllUsers] = useState<{ id: number; name: string; email: string }[]>([]);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  useEffect(() => { fetch("/api/users").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setAllUsers(d); }); }, []);

  const [logoUploading, setLogoUploading] = useState(false);

  // Show Reports
  type ShowReport = { id: number; reportDate: string; venue: string | null; performance: string | null; attendance: number | null; notes: string | null; createdByUser: { id: number; name: string } | null };
  const [showReports, setShowReports] = useState<ShowReport[]>([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [editReport, setEditReport] = useState<ShowReport | null>(null);
  const BLANK_REPORT = { reportDate: "", venue: "", performance: "", attendance: "", notes: "" };
  const [reportForm, setReportForm] = useState(BLANK_REPORT);

  async function reloadReports() {
    const data = await fetch(`/api/productions/${id}/show-reports`).then(r => r.json());
    if (Array.isArray(data)) setShowReports(data);
  }
  useEffect(() => { if (tab === "reports") reloadReports(); }, [tab, id]);

  async function saveReport(e: React.FormEvent) {
    e.preventDefault();
    if (editReport) {
      await fetch(`/api/show-reports/${editReport.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reportForm) });
    } else {
      await fetch(`/api/productions/${id}/show-reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reportForm) });
    }
    setShowReportForm(false);
    setEditReport(null);
    setReportForm(BLANK_REPORT);
    reloadReports();
  }

  async function deleteReport(rid: number) {
    if (!confirm("Delete this show report?")) return;
    await fetch(`/api/show-reports/${rid}`, { method: "DELETE" });
    reloadReports();
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    const fd = new FormData();
    fd.append("logo", file);
    const res = await fetch(`/api/productions/${id}/logo`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.logoUrl) setProd((p) => p ? { ...p, logoUrl: data.logoUrl } : p);
    setLogoUploading(false);
  }

  async function removeLogo() {
    await fetch(`/api/productions/${id}/logo`, { method: "DELETE" });
    setProd((p) => p ? { ...p, logoUrl: null } : p);
  }

  // Tour stops
  const [tourStops, setTourStops] = useState<TourStop[]>([]);
  const [allVenues, setAllVenues] = useState<VenueRef[]>([]);
  const [showTourForm, setShowTourForm] = useState(false);
  const [editStop, setEditStop] = useState<TourStop | null>(null);
  const [expandedStopNotes, setExpandedStopNotes] = useState<Set<number>>(new Set());
  const [stopNoteDrafts, setStopNoteDrafts] = useState<Record<number, string>>({});
  const BLANK_STOP = { venueId: "", loadInDate: "", startDate: "", endDate: "", performanceStart: "", performanceEnd: "", notes: "" };
  const [stopForm, setStopForm] = useState(BLANK_STOP);
  const [venueSearch, setVenueSearch] = useState("");
  useEffect(() => { fetch("/api/venues").then(r => r.json()).then(d => { if (Array.isArray(d)) setAllVenues(d); }); }, []);

  async function reloadTourStops() {
    const data = await fetch(`/api/productions/${id}/tour-stops`).then(r => r.json());
    if (Array.isArray(data)) setTourStops(data);
  }

  async function saveStop(e: React.FormEvent) {
    e.preventDefault();
    if (editStop) {
      await fetch(`/api/tour-stops/${editStop.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stopForm) });
    } else {
      await fetch(`/api/productions/${id}/tour-stops`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stopForm) });
    }
    setShowTourForm(false);
    setEditStop(null);
    setStopForm(BLANK_STOP);
    setVenueSearch("");
    reloadTourStops();
  }

  async function deleteStop(stopId: number) {
    if (!confirm("Remove this tour stop?")) return;
    await fetch(`/api/tour-stops/${stopId}`, { method: "DELETE" });
    reloadTourStops();
  }

  async function addTeamMember(userId: number) {
    await fetch(`/api/productions/${id}/team`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    reload();
  }
  async function removeTeamMember(userId: number) {
    await fetch(`/api/productions/${id}/team/${userId}`, { method: "DELETE" });
    reload();
  }

  // Contacts
  type ProdContact = { id: number; section: string; sortOrder: number; name: string; company: string | null; role: string | null; phone: string | null; email: string | null; notes: string | null };
  const [contacts, setContacts] = useState<ProdContact[]>([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editContact, setEditContact] = useState<ProdContact | null>(null);
  const BLANK_CONTACT = { section: "General", name: "", company: "", role: "", phone: "", email: "", notes: "" };
  const [contactForm, setContactForm] = useState(BLANK_CONTACT);
  const [dragContactId, setDragContactId] = useState<number | null>(null);
  const [showContra, setShowContra] = useState(false);

  async function reloadContacts() {
    const data = await fetch(`/api/productions/${id}/contacts`).then(r => r.json());
    if (Array.isArray(data)) setContacts(data);
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    if (editContact) {
      await fetch(`/api/production-contacts/${editContact.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contactForm) });
    } else {
      await fetch(`/api/productions/${id}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contactForm) });
    }
    setShowContactForm(false);
    setEditContact(null);
    setContactForm(BLANK_CONTACT);
    reloadContacts();
  }

  async function deleteContact(cid: number) {
    if (!confirm("Delete this contact?")) return;
    await fetch(`/api/production-contacts/${cid}`, { method: "DELETE" });
    reloadContacts();
  }

  const [showEventForm, setShowEventForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState<number | null>(null);
  const [showPSGExpenseForm, setShowPSGExpenseForm] = useState<number | null>(null);
  const [editingPSGExpense, setEditingPSGExpense] = useState<Expense | null>(null);
  const [psgExpenseForm, setPSGExpenseForm] = useState<typeof BLANK_PSG_EXPENSE & { id?: number }>(BLANK_PSG_EXPENSE);
  const [psgReceiptFile, setPsgReceiptFile] = useState<File | null>(null);
  const [editProd, setEditProd] = useState(false);

  // Call sheets state
  type CSEntry = { id: number; discipline: string; name: string | null; role: string | null; callTime: string | null; notes: string | null; sortOrder: number };
  type CallSheet = { id: number; date: string; title: string | null; venue: string | null; generalNotes: string | null; entries: CSEntry[] };
  const [callSheets, setCallSheets] = useState<CallSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState<CallSheet | null>(null);
  const [showNewSheetForm, setShowNewSheetForm] = useState(false);
  const BLANK_SHEET = { date: "", title: "", venue: "", generalNotes: "" };
  const [sheetForm, setSheetForm] = useState(BLANK_SHEET);
  const BLANK_ENTRY = { discipline: "", name: "", role: "", callTime: "", notes: "" };
  const [entryForm, setEntryForm] = useState(BLANK_ENTRY);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CSEntry | null>(null);

  const [eventForm, setEventForm] = useState({ title: "", type: "Rehearsal", startAt: "", endAt: "", location: "", notes: "" });
  const [budgetForm, setBudgetForm] = useState({ department: "Scenery", description: "", nominalCode: "", budgeted: "", notes: "" });
  const [expenseForm, setExpenseForm] = useState<typeof BLANK_EXPENSE & { id?: number }>(BLANK_EXPENSE);
  const [prodForm, setProdForm] = useState({ name: "", type: "", venue: "", venueId: "", isTour: false, startDate: "", endDate: "", status: "", announcementStatus: "not_announced", color: "", notes: "", reportEmail: "", sharepointUrl: "" });

  useEffect(() => {
    reload();
    fetch("/api/crew").then((r) => r.json()).then(setAllCrew);
    fetch("/api/hotels").then((r) => r.json()).then(setAllHotels);
    reloadCallSheets();
    reloadKeyDates();
    reloadTourStops();
    reloadContacts();
  }, [id]);

  async function reloadKeyDates() {
    const data = await fetch(`/api/productions/${id}/key-dates`).then(r => r.json());
    if (Array.isArray(data)) setKeyDates(data);
  }

  async function saveKd(e: React.FormEvent) {
    e.preventDefault();
    if (editKd) {
      await fetch(`/api/key-dates/${editKd.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kdForm) });
    } else {
      await fetch(`/api/productions/${id}/key-dates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kdForm) });
    }
    setShowKdForm(false);
    setEditKd(null);
    setKdForm(BLANK_KD);
    reloadKeyDates();
  }

  async function deleteKd(kdId: number) {
    await fetch(`/api/key-dates/${kdId}`, { method: "DELETE" });
    reloadKeyDates();
  }

  async function reloadCallSheets() {
    const data = await fetch(`/api/productions/${id}/call-sheets`).then((r) => r.json());
    setCallSheets(data);
    setActiveSheet((prev) => prev ? (data.find((s: CallSheet) => s.id === prev.id) ?? data[0] ?? null) : (data[0] ?? null));
  }

  async function saveNewSheet(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/productions/${id}/call-sheets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sheetForm) });
    setSheetForm(BLANK_SHEET);
    setShowNewSheetForm(false);
    await reloadCallSheets();
  }

  async function deleteSheet(sheetId: number) {
    await fetch(`/api/call-sheets/${sheetId}`, { method: "DELETE" });
    setActiveSheet(null);
    await reloadCallSheets();
  }

  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSheet) return;
    if (editingEntry) {
      await fetch(`/api/call-sheet-entries/${editingEntry.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entryForm) });
    } else {
      await fetch(`/api/call-sheets/${activeSheet.id}/entries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entryForm) });
    }
    setEntryForm(BLANK_ENTRY);
    setShowEntryForm(false);
    setEditingEntry(null);
    await reloadCallSheets();
  }

  async function deleteEntry(entryId: number) {
    await fetch(`/api/call-sheet-entries/${entryId}`, { method: "DELETE" });
    await reloadCallSheets();
  }

  async function reload() {
    const data = await fetch(`/api/productions/${id}`).then((r) => r.json());
    setProd(data);
    setProdForm({
      name: data.name, type: data.type, venue: data.venue ?? "",
      venueId: data.venueId ? String(data.venueId) : "",
      isTour: data.isTour ?? false,
      startDate: data.startDate ? data.startDate.slice(0, 10) : "",
      endDate: data.endDate ? data.endDate.slice(0, 10) : "",
      status: data.status, announcementStatus: data.announcementStatus ?? "not_announced", color: data.color ?? "", notes: data.notes ?? "", reportEmail: data.reportEmail ?? "", sharepointUrl: data.sharepointUrl ?? "",
    });
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/productions/${id}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eventForm) });
    setShowEventForm(false);
    setEventForm({ title: "", type: "Rehearsal", startAt: "", endAt: "", location: "", notes: "" });
    reload();
  }

  async function deleteEvent(eid: number) {
    if (!confirm("Delete this event?")) return;
    await fetch(`/api/events/${eid}`, { method: "DELETE" });
    reload();
  }

  async function saveBudgetLine(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/productions/${id}/budget`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(budgetForm) });
    setShowBudgetForm(false);
    setBudgetForm({ department: "Scenery", description: "", nominalCode: "", budgeted: "", notes: "" });
    reload();
  }

  async function deleteBudgetLine(lid: number) {
    if (!confirm("Delete this budget line and all its items?")) return;
    await fetch(`/api/budget-lines/${lid}`, { method: "DELETE" });
    reload();
  }

  function resetSpendDocState() {
    setExistingDocs([]);
    setPendingQuotes([]);
    setPendingPO([]);
    setPendingInvoices([]);
    setInvoiceDragOver(false);
    setQuoteDragOver(false);
  }

  async function addInvoiceFiles(files: File[]) {
    const newItems: PendingInvoice[] = files.map(f => ({ file: f, invoiceDate: "", invoiceAmount: "", invoiceNumber: "", issuedForPayment: false, extracting: true }));
    setPendingInvoices(prev => [...prev, ...newItems]);
    for (const item of newItems) {
      try {
        const fd = new FormData(); fd.append("file", item.file);
        const res = await fetch("/api/extract-invoice", { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          setPendingInvoices(prev => prev.map(x => x.file === item.file
            ? { ...x, extracting: false, invoiceDate: data.dueDate ?? x.invoiceDate, invoiceAmount: data.grossAmount != null ? String(data.grossAmount) : x.invoiceAmount, invoiceNumber: data.invoiceNumber ?? x.invoiceNumber }
            : x));
          if (data.supplier) setExpenseForm(f => f.supplier ? f : { ...f, supplier: data.supplier });
        } else {
          setPendingInvoices(prev => prev.map(x => x.file === item.file ? { ...x, extracting: false } : x));
        }
      } catch {
        setPendingInvoices(prev => prev.map(x => x.file === item.file ? { ...x, extracting: false } : x));
      }
    }
  }

  async function uploadPendingDocs(expenseId: number) {
    const uploads: Promise<void>[] = [];
    for (const f of pendingQuotes) {
      const fd = new FormData(); fd.append("file", f); fd.append("type", "quote");
      uploads.push(fetch(`/api/budget-expenses/${expenseId}/documents`, { method: "POST", body: fd }).then(() => {}));
    }
    for (const f of pendingPO) {
      const fd = new FormData(); fd.append("file", f); fd.append("type", "po");
      uploads.push(fetch(`/api/budget-expenses/${expenseId}/documents`, { method: "POST", body: fd }).then(() => {}));
    }
    for (const inv of pendingInvoices) {
      const fd = new FormData();
      fd.append("file", inv.file); fd.append("type", "invoice");
      if (inv.invoiceDate) fd.append("invoiceDate", inv.invoiceDate);
      if (inv.invoiceAmount) fd.append("invoiceAmount", inv.invoiceAmount);
      if (inv.invoiceNumber) fd.append("invoiceNumber", inv.invoiceNumber);
      fd.append("issuedForPayment", String(inv.issuedForPayment));
      uploads.push(fetch(`/api/budget-expenses/${expenseId}/documents`, { method: "POST", body: fd }).then(() => {}));
    }
    await Promise.all(uploads);
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    setDocsUploading(true);
    // Auto-calculate gross cost (spent) from invoice totals
    const existingInvoiceTotal = existingDocs.filter(d => d.type === "invoice").reduce((s, d) => s + (d.invoiceAmount ?? 0), 0);
    const pendingInvoiceTotal = pendingInvoices.reduce((s, inv) => s + (Number(inv.invoiceAmount) || 0), 0);
    const autoSpent = existingInvoiceTotal + pendingInvoiceTotal;
    const payload = { ...expenseForm, spent: autoSpent };
    let expenseId: number;
    if (expenseForm.id) {
      await fetch(`/api/budget-expenses/${expenseForm.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      expenseId = expenseForm.id;
    } else {
      const res = await fetch(`/api/budget-lines/${showExpenseForm}/expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      expenseId = data.id;
    }
    await uploadPendingDocs(expenseId);
    setDocsUploading(false);
    setShowExpenseForm(null);
    setEditingExpense(null);
    setExpenseForm(BLANK_EXPENSE);
    resetSpendDocState();
    reload();
  }

  function openEditExpense(exp: Expense, lineId: number) {
    setExpenseForm({
      ...exp,
      id: exp.id,
      estimated: String(exp.estimated),
      committed: String(exp.committed),
      spent: String(exp.spent),
      poNumber: exp.poNumber ?? "",
      paymentDue: exp.paymentDue ? exp.paymentDue.slice(0, 10) : "",
      supplier: exp.supplier ?? "",
      notes: exp.notes ?? "",
      approvedBy: exp.approvedBy ?? "",
      approvedDate: exp.approvedDate ? exp.approvedDate.slice(0, 10) : "",
      approvalMethod: exp.approvalMethod ?? "",
    });
    setExistingDocs(exp.documents ?? []);
    setPendingQuotes([]);
    setPendingPO([]);
    setPendingInvoices([]);
    setEditingExpense(exp);
    setShowExpenseForm(lineId);
  }

  async function deleteExpense(eid: number) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/budget-expenses/${eid}`, { method: "DELETE" });
    reload();
  }

  async function savePSGExpense(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...psgExpenseForm, isPSGExpense: true, phase: "Capitalisation", estimated: 0, issuedForPayment: false, vatExempt: false };
    if (editingPSGExpense) {
      await fetch(`/api/budget-expenses/${editingPSGExpense.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      // upload receipt if any
      if (psgReceiptFile) {
        const fd = new FormData(); fd.append("file", psgReceiptFile); fd.append("type", "invoice");
        await fetch(`/api/budget-expenses/${editingPSGExpense.id}/documents`, { method: "POST", body: fd });
      }
    } else {
      const res = await fetch(`/api/budget-lines/${showPSGExpenseForm}/expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const created = await res.json();
      if (psgReceiptFile) {
        const fd = new FormData(); fd.append("file", psgReceiptFile); fd.append("type", "invoice");
        await fetch(`/api/budget-expenses/${created.id}/documents`, { method: "POST", body: fd });
      }
    }
    setShowPSGExpenseForm(null); setEditingPSGExpense(null); setPSGExpenseForm(BLANK_PSG_EXPENSE); setPsgReceiptFile(null);
    reload();
  }

  async function deletePSGExpense(eid: number) {
    if (!confirm("Delete this PSG expense?")) return;
    await fetch(`/api/budget-expenses/${eid}`, { method: "DELETE" });
    reload();
  }

  async function deleteSpendDoc(docId: number) {
    await fetch(`/api/spend-documents/${docId}`, { method: "DELETE" });
    setExistingDocs(d => d.filter(doc => doc.id !== docId));
  }

  async function patchSpendDoc(docId: number, patch: Partial<SpendDoc>) {
    const res = await fetch(`/api/spend-documents/${docId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const updated = await res.json();
    setExistingDocs(d => d.map(doc => doc.id === docId ? updated : doc));
  }

  async function toggleIssued(exp: Expense) {
    await fetch(`/api/budget-expenses/${exp.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...exp, issuedForPayment: !exp.issuedForPayment }),
    });
    reload();
  }

  async function saveBooking(e: React.FormEvent) {
    e.preventDefault();
    if (bookingForm.id) {
      await fetch(`/api/hotel-bookings/${bookingForm.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bookingForm) });
    } else {
      await fetch(`/api/productions/${id}/hotel-bookings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bookingForm) });
    }
    setShowBookingForm(false);
    setEditBooking(null);
    setBookingForm(BLANK_BOOKING);
    reload();
  }

  async function deleteBooking(bid: number) {
    if (!confirm("Delete this booking?")) return;
    await fetch(`/api/hotel-bookings/${bid}`, { method: "DELETE" });
    reload();
  }

  async function toggleBookingPaid(b: HotelBooking) {
    await fetch(`/api/hotel-bookings/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...b, isPaid: !b.isPaid, checkIn: b.checkIn.slice(0, 10), checkOut: b.checkOut.slice(0, 10) }) });
    reload();
  }

  function openEditBooking(b: HotelBooking) {
    setBookingForm({ ...b, id: b.id, hotelId: String(b.hotelId), crewId: b.crewId ? String(b.crewId) : "", guestName: b.guestName ?? "", roomType: b.roomType ?? "", roomNumber: b.roomNumber ?? "", checkIn: b.checkIn.slice(0, 10), checkOut: b.checkOut.slice(0, 10), ratePerNight: b.ratePerNight ? String(b.ratePerNight) : "", totalCost: b.totalCost ? String(b.totalCost) : "", confirmationNo: b.confirmationNo ?? "", notes: b.notes ?? "" });
    setEditBooking(b);
    setShowBookingForm(true);
  }

  async function saveCrewAssignment(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/productions/${id}/crew`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crewForm),
    });
    setShowCrewForm(false);
    setCrewForm({ crewId: "", role: "", startDate: "", endDate: "", dayRate: "", notes: "" });
    reload();
  }

  async function removeCrewFromProduction(pcId: number, name: string) {
    if (!confirm(`Remove ${name} from this production?`)) return;
    await fetch(`/api/production-crew/${pcId}`, { method: "DELETE" });
    reload();
  }

  async function saveProd(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/productions/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prodForm) });
    setEditProd(false);
    reload();
  }

  async function deleteProd() {
    if (!confirm(`Permanently delete "${prod?.name}" and all its data?`)) return;
    await fetch(`/api/productions/${id}`, { method: "DELETE" });
    router.push("/");
  }

  async function saveMovement(e: React.FormEvent) {
    e.preventDefault();
    if (movementForm.id) {
      await fetch(`/api/haulage/${movementForm.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(movementForm) });
    } else {
      await fetch(`/api/productions/${id}/haulage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(movementForm) });
    }
    setShowMovementForm(false);
    setEditMovement(null);
    setMovementForm(BLANK_MOVEMENT);
    reload();
  }

  async function deleteMovement(mid: number) {
    if (!confirm("Delete this movement?")) return;
    await fetch(`/api/haulage/${mid}`, { method: "DELETE" });
    reload();
  }

  async function saveHaulageBudgetLine(lineId: string) {
    await fetch(`/api/productions/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...prod, haulageBudgetLineId: lineId ? Number(lineId) : null }) });
    reload();
  }

  function openEditMovement(m: HaulageMovement) {
    setMovementForm({ ...m, id: m.id, driverName: m.driverName ?? "", vehicleInfo: m.vehicleInfo ?? "", departureAt: m.departureAt.slice(0, 16), arrivalAt: m.arrivalAt ? m.arrivalAt.slice(0, 16) : "", cargo: m.cargo ?? "", notes: m.notes ?? "", estimatedCost: m.estimatedCost != null ? String(m.estimatedCost) : "", actualCost: m.actualCost != null ? String(m.actualCost) : "", rechargeable: m.rechargeable, budgetLineId: m.budgetLineId != null ? String(m.budgetLineId) : "" });
    setEditMovement(m);
    setShowMovementForm(true);
  }

  if (!prod) return <div className="py-20 text-center" style={{ color: "var(--psg-muted)" }}>Loading…</div>;

  const contraEstimateTotal = tourStops.reduce((s, t) => s + (t.contraEstimate ?? 0), 0);
  const contraActualTotal = tourStops.reduce((s, t) => s + (t.contraActual ?? 0), 0);
  const unlinkedHaulageMovements = prod.haulageMovements.filter((m) => !m.budgetLineId);
  const haulageEstimated = unlinkedHaulageMovements.reduce((s, m) => s + (m.estimatedCost ?? 0), 0);
  const haulageActual = unlinkedHaulageMovements.reduce((s, m) => s + (m.actualCost ?? 0), 0);
  const allHaulageEstimated = prod.haulageMovements.reduce((s, m) => s + (m.estimatedCost ?? 0), 0);
  const allHaulageActual = prod.haulageMovements.reduce((s, m) => s + (m.actualCost ?? 0), 0);
  const totalEstimated = prod.budgetLines.reduce((s, l) => s + l.expenses.reduce((e, x) => e + x.estimated, 0), 0) + contraEstimateTotal + allHaulageEstimated;
  const totalCommitted = prod.budgetLines.reduce((s, l) => s + l.expenses.reduce((e, x) => e + x.committed, 0), 0) + contraActualTotal + allHaulageActual;
  const totalSpent = prod.budgetLines.reduce((s, l) => s + l.expenses.reduce((e, x) => e + x.spent, 0), 0);
  const totalBudgeted = prod.budgetLines.reduce((s, l) => s + l.budgeted, 0);

  // Department summary for budget overview
  const deptSummary = prod.budgetLines.reduce((acc, l) => {
    if (!acc[l.department]) acc[l.department] = { budgeted: 0, estimated: 0, committed: 0, spent: 0 };
    acc[l.department].budgeted += l.budgeted;
    l.expenses.forEach((x) => {
      acc[l.department].estimated += x.estimated;
      acc[l.department].committed += x.committed;
      acc[l.department].spent += x.spent;
    });
    return acc;
  }, {} as Record<string, { budgeted: number; estimated: number; committed: number; spent: number }>);
  // Roll each linked movement's costs into its budget line's department
  prod.haulageMovements.forEach((m) => {
    if (!m.budgetLineId) return;
    const line = prod.budgetLines.find((l) => l.id === m.budgetLineId);
    if (line && deptSummary[line.department]) {
      deptSummary[line.department].estimated += m.estimatedCost ?? 0;
      deptSummary[line.department].committed += m.actualCost ?? 0;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Production logo — click opens SharePoint folder if URL set */}
          {prod.sharepointUrl ? (
            <a
              href={prod.sharepointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center border transition-opacity hover:opacity-80"
              style={{ borderColor: prod.logoUrl ? "transparent" : "var(--psg-card-border)", backgroundColor: prod.logoUrl ? "transparent" : "var(--psg-card-bg)" }}
              title="Open SharePoint folder"
            >
              {prod.logoUrl ? (
                <Image src={prod.logoUrl} alt={prod.name} fill className="object-contain p-1" />
              ) : (
                <span className="text-sm font-bold" style={{ color: "var(--psg-muted)" }}>{prod.name.slice(0, 2).toUpperCase()}</span>
              )}
            </a>
          ) : (
            <div
              className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center border"
              style={{ borderColor: prod.logoUrl ? "transparent" : "var(--psg-card-border)", backgroundColor: prod.logoUrl ? "transparent" : "var(--psg-card-bg)" }}
            >
              {prod.logoUrl ? (
                <Image src={prod.logoUrl} alt={prod.name} fill className="object-contain p-1" />
              ) : (
                <span className="text-sm font-bold" style={{ color: "var(--psg-muted)" }}>{prod.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
          )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {prod.color && <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: prod.color }} />}
            <h1 className="text-2xl font-bold text-white">{prod.name}</h1>
            <span className="text-sm" style={{ color: "var(--psg-muted)" }}>{prod.type}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[prod.status] ?? "bg-white/10 text-white/50"}`}>{prod.status}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ANN_COLORS[prod.announcementStatus] ?? "bg-white/10 text-white/50"}`}>{ANN_LABELS[prod.announcementStatus] ?? prod.announcementStatus}</span>
            {prod.isTour && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-900/60 text-purple-300">Tour</span>}
          </div>
          {prod.venueRef && <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>{prod.venueRef.name}{prod.venueRef.city ? ` · ${prod.venueRef.city}` : ""}</p>}
          {!prod.venueRef && prod.venue && <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>{prod.venue}</p>}
          {prod.isTour && tourStops.length > 0 && <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{tourStops.length} tour {tourStops.length === 1 ? "stop" : "stops"}</p>}
          {(prod.startDate || prod.endDate) && (
            <p className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>
              {prod.startDate ? fmtDate(prod.startDate) : "?"} → {prod.endDate ? fmtDate(prod.endDate) : "?"}
            </p>
          )}
          {/* Team */}
          <div className="flex items-center gap-2 mt-2 relative">
            {prod.team.map((m) => {
              const initials = m.user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <button key={m.user.id} title={`Remove ${m.user.name}`} onClick={() => removeTeamMember(m.user.id)}
                  className="group relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-opacity hover:opacity-70"
                  style={{ backgroundColor: "var(--psg-blue)" }}>
                  {initials}
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">{m.user.name}</span>
                </button>
              );
            })}
            <div className="relative">
              <button onClick={() => setShowTeamPicker((o) => !o)}
                className="w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center text-sm transition-colors hover:bg-white/10"
                style={{ borderColor: "var(--psg-muted)", color: "var(--psg-muted)" }} title="Add team member">+</button>
              {showTeamPicker && (
                <div className="absolute left-0 top-9 z-20 w-48 rounded-lg shadow-xl border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                  {allUsers.filter((u) => !prod.team.some((m) => m.user.id === u.id)).map((u) => (
                    <button key={u.id} onClick={() => { addTeamMember(u.id); setShowTeamPicker(false); }}
                      className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/10">{u.name}</button>
                  ))}
                  {allUsers.filter((u) => !prod.team.some((m) => m.user.id === u.id)).length === 0 && (
                    <div className="px-3 py-2 text-sm" style={{ color: "var(--psg-muted)" }}>All users added</div>
                  )}
                </div>
              )}
            </div>
            {prod.team.length > 0 && (
              <span className="text-xs" style={{ color: "var(--psg-muted)" }}>
                {prod.team.map((m) => m.user.name.split(" ")[0]).join(", ")}
              </span>
            )}
          </div>
        </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setEditProd(true)} className="border px-3 py-1.5 rounded text-sm hover:bg-white/5 transition-colors text-white" style={{ borderColor: "var(--psg-card-border)" }}>Edit</button>
          <button onClick={deleteProd} className="border px-3 py-1.5 rounded text-sm transition-colors text-red-400 hover:bg-red-900/20" style={{ borderColor: "rgba(248,113,113,0.3)" }}>Delete</button>
        </div>
      </div>

      {/* Budget summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Allocation", value: totalBudgeted, color: "text-white" },
          { label: "PM Budget", value: totalEstimated, color: "text-yellow-300" },
          { label: "Net Cost", value: totalCommitted, color: "text-orange-300" },
          { label: "Gross Cost", value: totalSpent, color: totalSpent > totalBudgeted ? "text-red-400" : "text-green-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border p-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--psg-muted)" }}>{label}</p>
            <p className={`text-xl font-bold ${color}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>


      {/* ── SCHEDULE TAB ── */}
      {tab === "schedule" && (
        <div className="space-y-6">

          {/* ── Key Dates ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Key Dates</h3>
              <button onClick={() => { setEditKd(null); setKdForm(BLANK_KD); setShowKdForm(true); }}
                className="text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors"
                style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                + Add Key Date
              </button>
            </div>

            {showKdForm && (
              <form onSubmit={saveKd} className="rounded-lg border p-4 mb-3 space-y-3" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-dark-bg)" }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Type</label>
                    <select required value={kdForm.type} onChange={e => setKdForm(f => ({ ...f, type: e.target.value }))} className={inp} style={inpStyle}>
                      {KEY_DATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Custom label <span style={{ color: "var(--psg-muted)" }}>(optional)</span></label>
                    <input value={kdForm.label} onChange={e => setKdForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Press Night — Lyttelton" className={inp} style={inpStyle} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Start date</label>
                    <input required type="date" value={kdForm.startDate} onChange={e => setKdForm(f => ({ ...f, startDate: e.target.value }))} className={inp} style={inpStyle} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>End date <span style={{ color: "var(--psg-muted)" }}>(optional)</span></label>
                    <input type="date" value={kdForm.endDate} onChange={e => setKdForm(f => ({ ...f, endDate: e.target.value }))} className={inp} style={inpStyle} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
                  <input value={kdForm.notes} onChange={e => setKdForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" className={inp} style={inpStyle} />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>
                    {editKd ? "Save" : "Add"}
                  </button>
                  <button type="button" onClick={() => { setShowKdForm(false); setEditKd(null); }} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
                </div>
              </form>
            )}

            {keyDates.length === 0 && !showKdForm && (
              <p className="text-sm py-3" style={{ color: "var(--psg-muted)" }}>No key dates yet. Add milestones to show on the central calendar.</p>
            )}
            <div className="space-y-1.5">
              {keyDates.map(kd => (
                <div key={kd.id} className="rounded-lg border px-4 py-3 flex items-center gap-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{kd.label || KEY_DATE_LABEL[kd.type] || kd.type}</span>
                      {kd.label && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">{KEY_DATE_LABEL[kd.type]}</span>}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
                      {fmtDate(kd.startDate)}
                      {kd.endDate && kd.endDate.slice(0,10) !== kd.startDate.slice(0,10) && ` → ${fmtDate(kd.endDate)}`}
                      {kd.notes && ` · ${kd.notes}`}
                    </p>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => { setEditKd(kd); setKdForm({ type: kd.type, label: kd.label ?? "", startDate: kd.startDate.slice(0,10), endDate: kd.endDate?.slice(0,10) ?? "", notes: kd.notes ?? "" }); setShowKdForm(true); }}
                      className="text-xs hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>Edit</button>
                    <button onClick={() => deleteKd(kd.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Daily Schedule ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Daily Schedule</h3>
              <div className="flex gap-2">
                <ExportMenu actions={[
                  { label: "Export PDF", onClick: () => exportSchedulePDF(prod.name, prod.events, prod.logoUrl) },
                  { label: "Export Excel", onClick: () => exportScheduleXLSX(prod.name, prod.events) },
                ]} />
                <button onClick={() => setShowEventForm(true)} className="text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors"
                  style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                  + Add Event
                </button>
              </div>
            </div>
            {prod.events.length === 0 && <p className="text-sm py-3" style={{ color: "var(--psg-muted)" }}>No events yet.</p>}
            <div className="space-y-1.5">
              {prod.events.map((ev) => (
                <div key={ev.id} className="rounded-lg border px-4 py-3 flex items-start justify-between gap-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-white">{ev.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${EVENT_COLORS[ev.type] ?? "bg-white/10 text-white/60"}`}>{ev.type}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
                      {fmtDate(ev.startAt)} · {fmtTime(ev.startAt)}–{fmtTime(ev.endAt)}
                      {ev.location && ` · ${ev.location}`}
                    </p>
                    {ev.notes && <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{ev.notes}</p>}
                  </div>
                  <button onClick={() => deleteEvent(ev.id)} className="text-xs text-red-400 hover:text-red-300 shrink-0">Delete</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── BUDGET TAB ── */}
      {tab === "budget" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1 rounded-lg overflow-hidden border text-xs" style={{ borderColor: "var(--psg-card-border)" }}>
              {(["detail", "summary"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setBudgetView(v)}
                  className="px-3 py-1.5 capitalize transition-colors"
                  style={budgetView === v
                    ? { backgroundColor: "var(--psg-blue)", color: "#fff" }
                    : { backgroundColor: "transparent", color: "var(--psg-muted)" }}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <ExportMenu actions={[
                { label: "Export PDF", onClick: () => exportBudgetPDF(prod.name, prod.budgetLines, prod.logoUrl) },
                { label: "Export Excel", onClick: () => exportBudgetXLSX(prod.name, prod.budgetLines) },
              ]} />
              <button onClick={() => setShowBudgetForm(true)} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
                + Add Department
              </button>
            </div>
          </div>

          {/* Summary view — department totals table */}
          {budgetView === "summary" && (
            <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <th className="px-4 py-3 text-left font-medium text-white">Department</th>
                    <th className="px-4 py-3 text-right font-medium text-white">Allocation</th>
                    <th className="px-4 py-3 text-right font-medium text-yellow-300">PM Budget</th>
                    <th className="px-4 py-3 text-right font-medium text-orange-300">Net Cost</th>
                    <th className="px-4 py-3 text-right font-medium text-green-400">Gross Cost</th>
                    <th className="px-4 py-3 text-right font-medium" style={{ color: "var(--psg-muted)" }}>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(deptSummary).map(([dept, s]) => (
                    <tr key={dept} className="border-t hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)" }}>
                      <td className="px-4 py-2.5 text-white">{dept}</td>
                      <td className="px-4 py-2.5 text-right" style={{ color: "var(--psg-muted)" }}>{fmt(s.budgeted)}</td>
                      <td className="px-4 py-2.5 text-right text-yellow-300">{fmt(s.estimated)}</td>
                      <td className="px-4 py-2.5 text-right text-orange-300">{fmt(s.committed)}</td>
                      <td className="px-4 py-2.5 text-right text-green-400">{fmt(s.spent)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${s.budgeted - s.committed < 0 ? "text-red-400" : "text-white/60"}`}>
                        {fmt(s.budgeted - s.committed)}
                      </td>
                    </tr>
                  ))}
                  {(haulageEstimated > 0 || haulageActual > 0) && (
                    <tr className="border-t" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "rgba(59,130,246,0.04)" }}>
                      <td className="px-4 py-2.5 text-white/70 text-xs italic">Haulage (from movements)</td>
                      <td className="px-4 py-2.5 text-right text-white/40 text-xs">—</td>
                      <td className="px-4 py-2.5 text-right text-yellow-300/70 text-xs">{haulageEstimated > 0 ? fmt(haulageEstimated) : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-orange-300/70 text-xs">{haulageActual > 0 ? fmt(haulageActual) : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-green-400/70 text-xs">—</td>
                      <td className="px-4 py-2.5 text-right text-white/40 text-xs">—</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.05)" }}>
                    <td className="px-4 py-3 font-semibold text-white">TOTAL</td>
                    <td className="px-4 py-3 text-right font-semibold text-white">{fmt(totalBudgeted)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-yellow-300">{fmt(totalEstimated)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-300">{fmt(totalCommitted)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400">{fmt(totalSpent)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${totalBudgeted - totalCommitted < 0 ? "text-red-400" : "text-white/60"}`}>
                      {fmt(totalBudgeted - totalCommitted)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Detail view — per department with line items */}
          {budgetView === "detail" && (
            <div className="space-y-4">
              {prod.budgetLines.length === 0 && <p className="text-center py-10" style={{ color: "var(--psg-muted)" }}>No budget lines yet.</p>}
              {prod.budgetLines.map((line) => {
                const lineMovements = prod.haulageMovements.filter((m) => m.budgetLineId === line.id);
                const lineHaulageEst = lineMovements.reduce((s, m) => s + (m.estimatedCost ?? 0), 0);
                const lineHaulageAct = lineMovements.reduce((s, m) => s + (m.actualCost ?? 0), 0);
                const lineEst = line.expenses.reduce((s, x) => s + x.estimated, 0) + lineHaulageEst;
                const lineCom = line.expenses.reduce((s, x) => s + x.committed, 0) + lineHaulageAct;
                const lineSpt = line.expenses.reduce((s, x) => s + x.spent, 0);
                const pct = line.budgeted > 0 ? Math.min((lineCom / line.budgeted) * 100, 100) : 0;
                const byPhase = PHASES.reduce((acc, p) => {
                  acc[p] = line.expenses.filter((x) => !x.isPSGExpense && x.phase === p);
                  return acc;
                }, {} as Record<string, Expense[]>);
                const psgExpenses = line.expenses.filter((x) => x.isPSGExpense);

                return (
                  <div key={line.id} className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                    {/* Department header */}
                    <div className="px-4 py-3 flex items-center justify-between gap-4" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderBottom: "1px solid var(--psg-card-border)" }}>
                      <div>
                        <span className="font-semibold text-sm text-white">{line.description}</span>
                        <span className="ml-2 text-xs" style={{ color: "var(--psg-muted)" }}>{line.department}</span>
                        {line.nominalCode && <span className="ml-1 text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "var(--psg-muted)" }}>{line.nominalCode}</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs shrink-0">
                        <span className="text-yellow-300">PM: {fmt(lineEst)}</span>
                        <span className="text-orange-300">Net: {fmt(lineCom)}</span>
                        <span className="text-green-400">Gross: {fmt(lineSpt)}</span>
                        <span style={{ color: "var(--psg-muted)" }}>/ {fmt(line.budgeted)}</span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => { setExpenseForm(BLANK_EXPENSE); resetSpendDocState(); setShowExpenseForm(line.id); }} className="text-xs border px-2 py-1 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-text)" }}>+ Spend</button>
                        <button onClick={() => { setPSGExpenseForm(BLANK_PSG_EXPENSE); setEditingPSGExpense(null); setPsgReceiptFile(null); setShowPSGExpenseForm(line.id); }} className="text-xs border px-2 py-1 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "rgba(99,102,241,0.5)", color: "rgb(165,180,252)" }}>+ PSG Expense</button>
                        <button onClick={() => deleteBudgetLine(line.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </div>
                    {/* Budget bar */}
                    <div className="h-1" style={{ backgroundColor: "var(--psg-card-border)" }}>
                      <div className={`h-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-orange-400" : "bg-green-400"}`} style={{ width: `${pct}%` }} />
                    </div>

                    {/* Haulage movements linked to this budget line */}
                    {lineMovements.length > 0 && (
                      <div>
                        <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-widest border-t" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.04)" }}>
                          Haulage Movements
                        </div>
                        <table className="w-full text-xs">
                          <tbody>
                            {lineMovements.map((m) => (
                              <tr key={m.id} className="border-t" style={{ borderColor: "var(--psg-card-border)" }}>
                                <td className="px-4 py-2 text-white w-1/4">{m.haulageCompany}</td>
                                <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{m.fromLocation} → {m.toLocation}</td>
                                <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{fmtDate(m.departureAt)}</td>
                                <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{m.cargo || "—"}</td>
                                <td className="px-3 py-2 text-right text-yellow-300 font-medium">{m.estimatedCost != null ? fmt(m.estimatedCost) : "—"}</td>
                                <td className="px-3 py-2 text-right text-orange-300 font-medium">{m.actualCost != null ? fmt(m.actualCost) : "—"}</td>
                                <td className="px-3 py-2 text-right">—</td>
                                {m.rechargeable && <td className="px-2 py-2"><span className="text-orange-400 border border-orange-400/40 rounded px-1 py-0.5">Invoice</span></td>}
                                {!m.rechargeable && <td className="px-2 py-2" />}
                                <td className="px-3 py-2" />
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Line items grouped by phase */}
                    {PHASES.map((phase) => {
                      const items = byPhase[phase];
                      if (items.length === 0) return null;
                      return (
                        <div key={phase}>
                          <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-widest border-t" style={{ borderColor: "var(--psg-card-border)", color: PHASE_COLORS[phase] ?? "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                            {phase}
                          </div>
                          <table className="w-full text-xs">
                            <tbody>
                              {items.map((x) => (
                                <tr key={x.id} className="border-t hover:bg-white/5 transition-colors group" style={{ borderColor: "var(--psg-card-border)" }}>
                                  <td className="px-4 py-2 text-white w-1/4">{x.description}</td>
                                  <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{x.supplier || "—"}</td>
                                  <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{x.poNumber ? `PO: ${x.poNumber}` : ""}</td>
                                  <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{x.paymentDue ? fmtShortDate(x.paymentDue) : ""}</td>
                                  <td className="px-3 py-2 text-right text-yellow-300 font-medium">{x.estimated > 0 ? fmt(x.estimated) : "—"}</td>
                                  <td className="px-3 py-2 text-right text-orange-300 font-medium">{x.committed > 0 ? fmt(x.committed) : "—"}</td>
                                  <td className="px-3 py-2 text-right text-green-400 font-medium">{x.spent > 0 ? fmt(x.spent) : "—"}</td>
                                  <td className="px-3 py-2">
                                    <button
                                      onClick={() => toggleIssued(x)}
                                      className={`px-2 py-0.5 rounded-full ${x.issuedForPayment ? "bg-green-900/60 text-green-300" : "bg-white/10 text-white/40"}`}
                                    >
                                      {x.issuedForPayment ? "Issued" : "Pending"}
                                    </button>
                                  </td>
                                  {x.vatExempt && <td className="px-2 py-2 text-white/30 text-xs">No VAT</td>}
                                  {!x.vatExempt && <td className="px-2 py-2" />}
                                  <td className="px-3 py-2 opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
                                    <button onClick={() => openEditExpense(x, line.id)} className="text-blue-400 hover:text-blue-300">Edit</button>
                                    <button onClick={() => deleteExpense(x.id)} className="text-red-400 hover:text-red-300">×</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}

                    {/* PSG Expenses section */}
                    {psgExpenses.length > 0 && (
                      <div>
                        <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-widest border-t" style={{ borderColor: "var(--psg-card-border)", color: "rgb(165,180,252)", backgroundColor: "rgba(99,102,241,0.06)" }}>
                          PSG Expenses
                        </div>
                        <table className="w-full text-xs">
                          <tbody>
                            {psgExpenses.map((x) => (
                              <tr key={x.id} className="border-t hover:bg-white/5 transition-colors group" style={{ borderColor: "var(--psg-card-border)" }}>
                                <td className="px-4 py-2 text-white w-1/4">{x.description}</td>
                                <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{x.supplier || "—"}</td>
                                <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{x.paymentMethod || "—"}</td>
                                <td className="px-3 py-2" style={{ color: "var(--psg-muted)" }}>{x.paymentDue ? fmtShortDate(x.paymentDue) : ""}</td>
                                <td className="px-3 py-2 text-right" />
                                <td className="px-3 py-2 text-right text-orange-300 font-medium">{x.committed > 0 ? fmt(x.committed) : "—"}</td>
                                <td className="px-3 py-2 text-right text-green-400 font-medium">{x.spent > 0 ? fmt(x.spent) : "—"}</td>
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2 opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
                                  <button onClick={() => { setPSGExpenseForm({ description: x.description, supplier: x.supplier ?? "", committed: String(x.committed), spent: String(x.spent), paymentDue: x.paymentDue ? x.paymentDue.slice(0, 10) : "", notes: x.notes ?? "", paymentMethod: x.paymentMethod ?? "", id: x.id }); setEditingPSGExpense(x); setPsgReceiptFile(null); setShowPSGExpenseForm(null); }} className="text-blue-400 hover:text-blue-300">Edit</button>
                                  <button onClick={() => deletePSGExpense(x.id)} className="text-red-400 hover:text-red-300">×</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Venue Contra section */}
          {tourStops.length > 0 && (
            <div>
              <button onClick={() => setShowContra(v => !v)} className="flex items-center gap-2 mb-3 hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>
                <span className="text-xs">{showContra ? "▾" : "▸"}</span>
                <span className="text-sm font-semibold text-white">Venue Contra</span>
                <span className="text-xs">{fmt(contraEstimateTotal)} est · {fmt(contraActualTotal)} act</span>
              </button>
              {showContra && <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--psg-card-border)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--psg-card-border)" }}>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Venue</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Estimate</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tourStops.sort((a, b) => a.stopNumber - b.stopNumber).map((stop, i) => (
                      <tr key={stop.id} style={{ borderTop: i > 0 ? "1px solid var(--psg-card-border)" : undefined }}>
                        <td className="px-4 py-3 text-white">
                          <span className="text-xs mr-2 font-mono" style={{ color: "var(--psg-muted)" }}>#{stop.stopNumber}</span>
                          {stop.venue.name}{stop.venue.city ? `, ${stop.venue.city}` : ""}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-yellow-300">{stop.contraEstimate != null ? fmt(stop.contraEstimate) : <span style={{ color: "var(--psg-muted)" }}>—</span>}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-orange-300">{stop.contraActual != null ? fmt(stop.contraActual) : <span style={{ color: "var(--psg-muted)" }}>—</span>}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                      <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--psg-muted)" }}>Total</td>
                      <td className="px-4 py-3 text-right font-semibold text-yellow-300">{fmt(contraEstimateTotal)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-orange-300">{fmt(contraActualTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>}
            </div>
          )}

          {/* Rechargeable haulage panel */}
          {prod.haulageMovements.some((m) => m.rechargeable) && (
            <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "rgba(251,146,60,0.4)" }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "rgba(251,146,60,0.08)", borderBottom: "1px solid rgba(251,146,60,0.3)" }}>
                <span className="text-orange-400 font-semibold text-sm">Rechargeables — Pending Client Invoice</span>
                <span className="ml-auto text-xs text-orange-400/70">{prod.haulageMovements.filter((m) => m.rechargeable).length} movement{prod.haulageMovements.filter((m) => m.rechargeable).length !== 1 ? "s" : ""}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--psg-muted)" }}>Company</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--psg-muted)" }}>Route</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--psg-muted)" }}>Date</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium" style={{ color: "var(--psg-muted)" }}>Actual Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {prod.haulageMovements.filter((m) => m.rechargeable).map((m) => (
                    <tr key={m.id} className="border-t" style={{ borderColor: "var(--psg-card-border)" }}>
                      <td className="px-4 py-2.5 text-white">{m.haulageCompany}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--psg-muted)" }}>{m.fromLocation} → {m.toLocation}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: "var(--psg-muted)" }}>{fmtDate(m.departureAt)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-orange-400">{m.actualCost != null ? fmt(m.actualCost) : <span style={{ color: "var(--psg-muted)" }}>TBC</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid rgba(251,146,60,0.3)", backgroundColor: "rgba(251,146,60,0.06)" }}>
                    <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-orange-400">Total to invoice</td>
                    <td className="px-4 py-2.5 text-right font-bold text-orange-400">{fmt(prod.haulageMovements.filter((m) => m.rechargeable).reduce((s, m) => s + (m.actualCost ?? 0), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CREW TAB ── */}
      {tab === "crew" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <ExportMenu actions={[
              { label: "Export PDF", onClick: () => exportCrewPDF(prod.name, prod.crew.map((pc) => pc.crew), prod.logoUrl) },
              { label: "Export Excel", onClick: () => exportCrewXLSX(prod.name, prod.crew.map((pc) => pc.crew)) },
            ]} />
            <button onClick={() => setShowCrewForm(true)} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
              + Add Crew Member
            </button>
          </div>
          {prod.crew.length === 0 ? (
            <p className="text-center py-10" style={{ color: "var(--psg-muted)" }}>No crew assigned to this production yet.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <th className="px-4 py-3 text-left font-medium text-white">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Role on This Show</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Dates</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Day Rate</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Contact</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Insurance</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {prod.crew.map((pc) => {
                    const insExpired = pc.crew.insuranceExpiry && new Date(pc.crew.insuranceExpiry) < new Date();
                    const insExpiringSoon = !insExpired && pc.crew.insuranceExpiry && (new Date(pc.crew.insuranceExpiry).getTime() - Date.now()) < 60 * 24 * 60 * 60 * 1000;
                    return (
                      <tr key={pc.id} className="border-t hover:bg-white/5 transition-colors group" style={{ borderColor: "var(--psg-card-border)" }}>
                        <td className="px-4 py-3">
                          <a href={`/crew/${pc.crewId}`} className="font-medium text-white hover:underline">{pc.crew.name}</a>
                          <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{pc.crew.discipline}</p>
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{pc.role || pc.crew.discipline}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                          {pc.startDate ? fmtShortDate(pc.startDate) : "—"} → {pc.endDate ? fmtShortDate(pc.endDate) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>
                          {pc.dayRate ? fmt(pc.dayRate) + "/day" : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                          {pc.crew.email && <div>{pc.crew.email}</div>}
                          {pc.crew.phone && <div>{pc.crew.phone}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {pc.crew.insuranceExpiry ? (
                            <span className={`px-2 py-0.5 rounded-full font-medium ${insExpired ? "bg-red-900/60 text-red-300" : insExpiringSoon ? "bg-yellow-900/60 text-yellow-300" : "bg-green-900/40 text-green-400"}`}>
                              {insExpired ? "Expired" : insExpiringSoon ? "Expiring" : "Valid"}
                            </span>
                          ) : <span style={{ color: "var(--psg-muted)" }}>—</span>}
                        </td>
                        <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => removeCrewFromProduction(pc.id, pc.crew.name)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ACCOMMODATION TAB ── */}
      {tab === "accommodation" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {prod.hotelBookings.length > 0 && (
              <div className="flex gap-4 text-sm">
                <span style={{ color: "var(--psg-muted)" }}>Total cost: <span className="text-white font-medium">{fmt(prod.hotelBookings.reduce((s, b) => s + (b.totalCost ?? 0), 0))}</span></span>
                <span style={{ color: "var(--psg-muted)" }}>Paid: <span className="text-green-400 font-medium">{prod.hotelBookings.filter((b) => b.isPaid).length} / {prod.hotelBookings.length}</span></span>
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              <ExportMenu actions={[
                { label: "Export PDF", onClick: () => exportAccommodationPDF(prod.name, prod.hotelBookings, prod.logoUrl) },
                { label: "Export Excel", onClick: () => exportAccommodationXLSX(prod.name, prod.hotelBookings) },
              ]} />
              <button onClick={() => { setBookingForm(BLANK_BOOKING); setEditBooking(null); setShowBookingForm(true); }} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
                + Add Booking
              </button>
            </div>
          </div>

          {prod.hotelBookings.length === 0 ? (
            <p className="text-center py-10" style={{ color: "var(--psg-muted)" }}>No accommodation booked for this production yet.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <th className="px-4 py-3 text-left font-medium text-white">Guest</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Hotel</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Room</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Check In</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Check Out</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Nights</th>
                    <th className="px-4 py-3 text-right font-medium text-white">Total</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Ref</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {prod.hotelBookings.map((b) => {
                    const nights = Math.round((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / (1000 * 60 * 60 * 24));
                    const guestLabel = b.crew ? b.crew.name : (b.guestName || "Unassigned");
                    return (
                      <tr key={b.id} className="border-t hover:bg-white/5 transition-colors group" style={{ borderColor: "var(--psg-card-border)" }}>
                        <td className="px-4 py-3">
                          <p className={`font-medium ${b.crew || b.guestName ? "text-white" : ""}`} style={!b.crew && !b.guestName ? { color: "var(--psg-muted)" } : {}}>
                            {guestLabel}
                          </p>
                          {b.crew && <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{b.crew.discipline}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white">{b.hotel.name}</p>
                          {b.hotel.city && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>{b.hotel.city}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                          {b.roomType && <div>{b.roomType}</div>}
                          {b.roomNumber && <div>Room {b.roomNumber}</div>}
                          {!b.roomType && !b.roomNumber && "—"}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>{fmtShortDate(b.checkIn)}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>{fmtShortDate(b.checkOut)}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>{nights}</td>
                        <td className="px-4 py-3 text-right font-medium text-white">{b.totalCost ? fmt(b.totalCost) : b.ratePerNight ? fmt(b.ratePerNight * nights) : "—"}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{b.confirmationNo || "—"}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleBookingPaid(b)} className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.isPaid ? "bg-green-900/60 text-green-300" : "bg-white/10 text-white/50"}`}>
                            {b.isPaid ? "Paid" : "Unpaid"}
                          </button>
                        </td>
                        <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-2">
                            <button onClick={() => openEditBooking(b)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                            <button onClick={() => deleteBooking(b.id)} className="text-xs text-red-400 hover:text-red-300">×</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── HAULAGE TAB ── */}
      {tab === "haulage" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <ExportMenu actions={[
              { label: "Export PDF", onClick: () => exportHaulagePDF(prod.name, prod.haulageMovements, false, prod.logoUrl) },
              { label: "Export Excel", onClick: () => exportHaulageXLSX(prod.name, prod.haulageMovements) },
            ]} />
            <button onClick={() => { setMovementForm(BLANK_MOVEMENT); setEditMovement(null); setShowMovementForm(true); }} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
              + Add Movement
            </button>
          </div>
          {prod.haulageMovements.length === 0 ? (
            <p className="text-center py-10" style={{ color: "var(--psg-muted)" }}>No haulage movements recorded yet.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <th className="px-4 py-3 text-left font-medium text-white">Company</th>
                    <th className="px-4 py-3 text-left font-medium text-white">From</th>
                    <th className="px-4 py-3 text-left font-medium text-white">To</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Departure</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Arrival</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Driver / Vehicle</th>
                    <th className="px-4 py-3 text-left font-medium text-white">Cargo</th>
                    <th className="px-4 py-3 text-right font-medium text-white">Estimated</th>
                    <th className="px-4 py-3 text-right font-medium text-white">Actual</th>
                    <th className="px-4 py-3 text-center font-medium text-white">Recharge</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {prod.haulageMovements.map((m) => (
                    <tr key={m.id} className="border-t hover:bg-white/5 transition-colors group" style={{ borderColor: "var(--psg-card-border)" }}>
                      <td className="px-4 py-3 font-medium text-white">{m.haulageCompany}</td>
                      <td className="px-4 py-3 text-white">{m.fromLocation}</td>
                      <td className="px-4 py-3 text-white">{m.toLocation}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>
                        <div>{fmtDate(m.departureAt)}</div>
                        <div className="text-xs">{fmtTime(m.departureAt)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>
                        {m.arrivalAt ? (
                          <>
                            <div>{fmtDate(m.arrivalAt)}</div>
                            <div className="text-xs">{fmtTime(m.arrivalAt)}</div>
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                        {m.driverName && <div>{m.driverName}</div>}
                        {m.vehicleInfo && <div>{m.vehicleInfo}</div>}
                        {!m.driverName && !m.vehicleInfo && "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{m.cargo || "—"}</td>
                      <td className="px-4 py-3 text-right text-sm" style={{ color: "var(--psg-muted)" }}>{m.estimatedCost != null ? fmt(m.estimatedCost) : "—"}</td>
                      <td className="px-4 py-3 text-right text-sm" style={{ color: "var(--psg-muted)" }}>{m.actualCost != null ? fmt(m.actualCost) : "—"}</td>
                      <td className="px-4 py-3 text-center">{m.rechargeable && <span className="inline-block text-xs font-semibold text-orange-400 border border-orange-400/40 rounded px-1.5 py-0.5">Invoice</span>}</td>
                      <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-2">
                          <button onClick={() => openEditMovement(m)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                          <button onClick={() => deleteMovement(m.id)} className="text-xs text-red-400 hover:text-red-300">×</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CALL SHEETS TAB ── */}
      {tab === "callsheets" && (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            {/* Sheet list sidebar */}
            <div className="w-48 shrink-0 space-y-1">
              {callSheets.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSheet(s)}
                  className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
                  style={activeSheet?.id === s.id
                    ? { backgroundColor: "var(--psg-blue)", color: "#fff" }
                    : { backgroundColor: "var(--psg-card-bg)", color: "var(--psg-text)", border: "1px solid var(--psg-card-border)" }}
                >
                  <div className="font-medium">{s.title || "Call Sheet"}</div>
                  <div className="text-xs opacity-70">{new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                </button>
              ))}
              <button
                onClick={() => setShowNewSheetForm(true)}
                className="w-full text-left px-3 py-2 rounded text-sm border border-dashed transition-colors hover:border-white/40"
                style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
              >
                + New Call Sheet
              </button>
            </div>

            {/* Active sheet */}
            <div className="flex-1 min-w-0">
              {activeSheet ? (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold">{activeSheet.title || "Call Sheet"}</h3>
                        <div className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>
                          {new Date(activeSheet.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                          {activeSheet.venue && ` · ${activeSheet.venue}`}
                        </div>
                        {activeSheet.generalNotes && <div className="text-sm mt-2" style={{ color: "var(--psg-muted)" }}>{activeSheet.generalNotes}</div>}
                      </div>
                      <button onClick={() => { if (confirm("Delete this call sheet?")) deleteSheet(activeSheet.id); }} className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>Delete</button>
                    </div>
                  </div>

                  {/* Entries table */}
                  <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
                      <span className="text-sm font-medium">Crew Calls</span>
                      <button
                        onClick={() => { setEditingEntry(null); setEntryForm(BLANK_ENTRY); setShowEntryForm(true); }}
                        className="text-xs px-3 py-1 rounded font-medium text-white"
                        style={{ backgroundColor: "var(--psg-blue)" }}
                      >
                        + Add Row
                      </button>
                    </div>

                    {activeSheet.entries.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--psg-muted)" }}>No crew calls yet — add a row to get started.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left" style={{ borderColor: "var(--psg-card-border)" }}>
                              <th className="px-4 py-2 font-medium text-xs uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Discipline</th>
                              <th className="px-4 py-2 font-medium text-xs uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Name</th>
                              <th className="px-4 py-2 font-medium text-xs uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Role</th>
                              <th className="px-4 py-2 font-medium text-xs uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Call Time</th>
                              <th className="px-4 py-2 font-medium text-xs uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>Notes</th>
                              <th className="px-4 py-2 w-16" />
                            </tr>
                          </thead>
                          <tbody>
                            {activeSheet.entries.map((entry, i) => (
                              <tr key={entry.id} className="border-b last:border-0" style={{ borderColor: "var(--psg-card-border)", backgroundColor: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                                <td className="px-4 py-2.5 font-medium">{entry.discipline}</td>
                                <td className="px-4 py-2.5" style={{ color: "var(--psg-muted)" }}>{entry.name || "—"}</td>
                                <td className="px-4 py-2.5" style={{ color: "var(--psg-muted)" }}>{entry.role || "—"}</td>
                                <td className="px-4 py-2.5">
                                  {entry.callTime ? (
                                    <span className="font-mono font-semibold" style={{ color: "var(--psg-blue)" }}>{entry.callTime}</span>
                                  ) : "—"}
                                </td>
                                <td className="px-4 py-2.5 text-xs" style={{ color: "var(--psg-muted)" }}>{entry.notes || ""}</td>
                                <td className="px-4 py-2.5">
                                  <div className="flex gap-1">
                                    <button onClick={() => { setEditingEntry(entry); setEntryForm({ discipline: entry.discipline, name: entry.name ?? "", role: entry.role ?? "", callTime: entry.callTime ?? "", notes: entry.notes ?? "" }); setShowEntryForm(true); }} className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>Edit</button>
                                    <button onClick={() => deleteEntry(entry.id)} className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>✕</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center" style={{ color: "var(--psg-muted)" }}>
                  {callSheets.length === 0 ? "No call sheets yet — create one to get started." : "Select a call sheet."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Call Sheet */}
      {showNewSheetForm && (
        <Modal title="New Call Sheet" onClose={() => { setShowNewSheetForm(false); setSheetForm(BLANK_SHEET); }}>
          <form onSubmit={saveNewSheet} className="space-y-3">
            <F label="Date *"><input required type="date" className={inp} style={inpStyle} value={sheetForm.date} onChange={(e) => setSheetForm((f) => ({ ...f, date: e.target.value }))} /></F>
            <F label="Title"><input className={inp} style={inpStyle} placeholder="e.g. Get In Day 1, Show Day" value={sheetForm.title} onChange={(e) => setSheetForm((f) => ({ ...f, title: e.target.value }))} /></F>
            <F label="Venue"><input className={inp} style={inpStyle} value={sheetForm.venue} onChange={(e) => setSheetForm((f) => ({ ...f, venue: e.target.value }))} /></F>
            <F label="General Notes"><textarea rows={2} className={inp} style={inpStyle} value={sheetForm.generalNotes} onChange={(e) => setSheetForm((f) => ({ ...f, generalNotes: e.target.value }))} /></F>
            <Btns onCancel={() => { setShowNewSheetForm(false); setSheetForm(BLANK_SHEET); }} label="Create Call Sheet" />
          </form>
        </Modal>
      )}

      {/* Modal: Add / Edit Call Sheet Entry */}
      {showEntryForm && (
        <Modal title={editingEntry ? "Edit Row" : "Add Crew Call"} onClose={() => { setShowEntryForm(false); setEditingEntry(null); setEntryForm(BLANK_ENTRY); }}>
          <form onSubmit={saveEntry} className="space-y-3">
            <F label="Discipline *"><input required className={inp} style={inpStyle} placeholder="e.g. Lighting, Sound, Staging" value={entryForm.discipline} onChange={(e) => setEntryForm((f) => ({ ...f, discipline: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Name"><input className={inp} style={inpStyle} placeholder="Leave blank for dept. call" value={entryForm.name} onChange={(e) => setEntryForm((f) => ({ ...f, name: e.target.value }))} /></F>
              <F label="Role"><input className={inp} style={inpStyle} placeholder="e.g. Head of LX" value={entryForm.role} onChange={(e) => setEntryForm((f) => ({ ...f, role: e.target.value }))} /></F>
            </div>
            <F label="Call Time"><input className={inp} style={inpStyle} placeholder="e.g. 08:00" value={entryForm.callTime} onChange={(e) => setEntryForm((f) => ({ ...f, callTime: e.target.value }))} /></F>
            <F label="Notes"><input className={inp} style={inpStyle} value={entryForm.notes} onChange={(e) => setEntryForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={() => { setShowEntryForm(false); setEditingEntry(null); setEntryForm(BLANK_ENTRY); }} label={editingEntry ? "Save Changes" : "Add Row"} />
          </form>
        </Modal>
      )}

      {/* Modal: Add / Edit Movement */}
      {showMovementForm && (
        <Modal title={editMovement ? "Edit Movement" : "Add Haulage Movement"} onClose={() => { setShowMovementForm(false); setEditMovement(null); setMovementForm(BLANK_MOVEMENT); }}>
          <form onSubmit={saveMovement} className="space-y-3">
            <F label="Haulage Company *"><input required className={inp} style={inpStyle} value={movementForm.haulageCompany} onChange={(e) => setMovementForm((f) => ({ ...f, haulageCompany: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="From *"><input required className={inp} style={inpStyle} value={movementForm.fromLocation} onChange={(e) => setMovementForm((f) => ({ ...f, fromLocation: e.target.value }))} /></F>
              <F label="To *"><input required className={inp} style={inpStyle} value={movementForm.toLocation} onChange={(e) => setMovementForm((f) => ({ ...f, toLocation: e.target.value }))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Departure *"><input required type="datetime-local" className={inp} style={inpStyle} value={movementForm.departureAt} onChange={(e) => setMovementForm((f) => ({ ...f, departureAt: e.target.value }))} /></F>
              <F label="Arrival"><input type="datetime-local" className={inp} style={inpStyle} value={movementForm.arrivalAt} onChange={(e) => setMovementForm((f) => ({ ...f, arrivalAt: e.target.value }))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Driver Name"><input className={inp} style={inpStyle} value={movementForm.driverName} onChange={(e) => setMovementForm((f) => ({ ...f, driverName: e.target.value }))} /></F>
              <F label="Vehicle Info"><input className={inp} style={inpStyle} value={movementForm.vehicleInfo} onChange={(e) => setMovementForm((f) => ({ ...f, vehicleInfo: e.target.value }))} placeholder="e.g. 7.5t curtainside" /></F>
            </div>
            <F label="Cargo / Description"><input className={inp} style={inpStyle} value={movementForm.cargo} onChange={(e) => setMovementForm((f) => ({ ...f, cargo: e.target.value }))} placeholder="e.g. Scenery and rigging" /></F>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={movementForm.notes} onChange={(e) => setMovementForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Estimated Cost (£)"><input type="number" min="0" step="0.01" className={inp} style={inpStyle} value={movementForm.estimatedCost} onChange={(e) => setMovementForm((f) => ({ ...f, estimatedCost: e.target.value }))} placeholder="0.00" /></F>
              <F label="Actual Cost (£)"><input type="number" min="0" step="0.01" className={inp} style={inpStyle} value={movementForm.actualCost} onChange={(e) => setMovementForm((f) => ({ ...f, actualCost: e.target.value }))} placeholder="0.00" /></F>
            </div>
            <F label="Budget Line">
              <select className={inp} style={inpStyle} value={movementForm.budgetLineId} onChange={(e) => setMovementForm((f) => ({ ...f, budgetLineId: e.target.value }))}>
                <option value="">— not linked to a budget line —</option>
                {prod.budgetLines.map((l) => (
                  <option key={l.id} value={l.id}>{l.department} · {l.description}</option>
                ))}
              </select>
            </F>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4 rounded accent-orange-400" checked={movementForm.rechargeable} onChange={(e) => setMovementForm((f) => ({ ...f, rechargeable: e.target.checked }))} />
              <span className="text-sm font-medium" style={{ color: "var(--psg-muted)" }}>Rechargeable to client</span>
              {movementForm.rechargeable && <span className="text-xs font-semibold text-orange-400 ml-1">— will appear in Finance as pending invoice</span>}
            </label>
            <Btns onCancel={() => { setShowMovementForm(false); setEditMovement(null); setMovementForm(BLANK_MOVEMENT); }} label={editMovement ? "Save Changes" : "Add Movement"} />
          </form>
        </Modal>
      )}

      {/* Modal: Add / Edit Booking */}
      {showBookingForm && (
        <Modal title={editBooking ? "Edit Booking" : "Add Booking"} onClose={() => { setShowBookingForm(false); setEditBooking(null); setBookingForm(BLANK_BOOKING); }}>
          <form onSubmit={saveBooking} className="space-y-3">
            <F label="Hotel *">
              <select required className={inp} style={inpStyle} value={bookingForm.hotelId} onChange={(e) => setBookingForm((f) => ({ ...f, hotelId: e.target.value }))}>
                <option value="">— select hotel —</option>
                {allHotels.map((h) => <option key={h.id} value={h.id}>{h.name}{h.city ? ` · ${h.city}` : ""}</option>)}
              </select>
            </F>
            <F label="Assign to Crew Member">
              <select className={inp} style={inpStyle} value={bookingForm.crewId} onChange={(e) => setBookingForm((f) => ({ ...f, crewId: e.target.value, guestName: e.target.value ? "" : f.guestName }))}>
                <option value="">— unassigned —</option>
                {allCrew.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.discipline}</option>)}
              </select>
            </F>
            {!bookingForm.crewId && (
              <F label="Guest Name (if not in crew database)">
                <input className={inp} style={inpStyle} value={bookingForm.guestName} onChange={(e) => setBookingForm((f) => ({ ...f, guestName: e.target.value }))} placeholder="Leave blank for block booking" />
              </F>
            )}
            <div className="grid grid-cols-2 gap-3">
              <F label="Check In *"><input required type="date" className={inp} style={inpStyle} value={bookingForm.checkIn} onChange={(e) => setBookingForm((f) => ({ ...f, checkIn: e.target.value }))} /></F>
              <F label="Check Out *"><input required type="date" className={inp} style={inpStyle} value={bookingForm.checkOut} onChange={(e) => setBookingForm((f) => ({ ...f, checkOut: e.target.value }))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Room Type"><input className={inp} style={inpStyle} value={bookingForm.roomType} onChange={(e) => setBookingForm((f) => ({ ...f, roomType: e.target.value }))} placeholder="e.g. Double, Twin" /></F>
              <F label="Room Number"><input className={inp} style={inpStyle} value={bookingForm.roomNumber} onChange={(e) => setBookingForm((f) => ({ ...f, roomNumber: e.target.value }))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Rate Per Night (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={bookingForm.ratePerNight} onChange={(e) => setBookingForm((f) => ({ ...f, ratePerNight: e.target.value }))} /></F>
              <F label="Total Cost (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={bookingForm.totalCost} onChange={(e) => setBookingForm((f) => ({ ...f, totalCost: e.target.value }))} /></F>
            </div>
            <F label="Confirmation / Ref No."><input className={inp} style={inpStyle} value={bookingForm.confirmationNo} onChange={(e) => setBookingForm((f) => ({ ...f, confirmationNo: e.target.value }))} /></F>
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input type="checkbox" checked={bookingForm.isPaid} onChange={(e) => setBookingForm((f) => ({ ...f, isPaid: e.target.checked }))} />
              Paid
            </label>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={bookingForm.notes} onChange={(e) => setBookingForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={() => { setShowBookingForm(false); setEditBooking(null); setBookingForm(BLANK_BOOKING); }} label={editBooking ? "Save Changes" : "Add Booking"} />
          </form>
        </Modal>
      )}

      {/* Modal: Add Crew to Production */}
      {showCrewForm && (
        <Modal title="Add Crew to Production" onClose={() => setShowCrewForm(false)}>
          <form onSubmit={saveCrewAssignment} className="space-y-3">
            <F label="Crew Member *">
              <select required className={inp} style={inpStyle} value={crewForm.crewId} onChange={(e) => setCrewForm((f) => ({ ...f, crewId: e.target.value }))}>
                <option value="">— select —</option>
                {allCrew.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} · {c.discipline}</option>
                ))}
              </select>
            </F>
            <F label="Role on this Production">
              <input className={inp} style={inpStyle} value={crewForm.role} onChange={(e) => setCrewForm((f) => ({ ...f, role: e.target.value }))} placeholder="Leave blank to use their discipline" />
            </F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Start Date"><input type="date" className={inp} style={inpStyle} value={crewForm.startDate} onChange={(e) => setCrewForm((f) => ({ ...f, startDate: e.target.value }))} /></F>
              <F label="End Date"><input type="date" className={inp} style={inpStyle} value={crewForm.endDate} onChange={(e) => setCrewForm((f) => ({ ...f, endDate: e.target.value }))} /></F>
            </div>
            <F label="Day Rate (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={crewForm.dayRate} onChange={(e) => setCrewForm((f) => ({ ...f, dayRate: e.target.value }))} /></F>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={crewForm.notes} onChange={(e) => setCrewForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={() => setShowCrewForm(false)} label="Add to Production" />
          </form>
        </Modal>
      )}

      {/* Modal: Add Event */}
      {showEventForm && (
        <Modal title="Add Event" onClose={() => setShowEventForm(false)}>
          <form onSubmit={saveEvent} className="space-y-3">
            <F label="Title *"><input required className={inp} style={inpStyle} value={eventForm.title} onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))} /></F>
            <F label="Type"><select className={inp} style={inpStyle} value={eventForm.type} onChange={(e) => setEventForm((f) => ({ ...f, type: e.target.value }))}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Start *"><input required type="datetime-local" className={inp} style={inpStyle} value={eventForm.startAt} onChange={(e) => setEventForm((f) => ({ ...f, startAt: e.target.value }))} /></F>
              <F label="End *"><input required type="datetime-local" className={inp} style={inpStyle} value={eventForm.endAt} onChange={(e) => setEventForm((f) => ({ ...f, endAt: e.target.value }))} /></F>
            </div>
            <F label="Location"><input className={inp} style={inpStyle} value={eventForm.location} onChange={(e) => setEventForm((f) => ({ ...f, location: e.target.value }))} /></F>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={eventForm.notes} onChange={(e) => setEventForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={() => setShowEventForm(false)} />
          </form>
        </Modal>
      )}

      {/* Modal: Add Department/Budget Line */}
      {showBudgetForm && (
        <Modal title="Add Budget Department" onClose={() => setShowBudgetForm(false)}>
          <form onSubmit={saveBudgetLine} className="space-y-3">
            <F label="Department">
              <input list="budget-departments" required className={inp} style={inpStyle} value={budgetForm.department} onChange={(e) => setBudgetForm((f) => ({ ...f, department: e.target.value }))} placeholder="e.g. Scenery" />
              <datalist id="budget-departments">
                {Array.from(new Set([...DEPARTMENTS, ...prod.budgetLines.map(l => l.department)])).map(d => <option key={d} value={d} />)}
              </datalist>
            </F>
            <F label="Description *"><input required className={inp} style={inpStyle} value={budgetForm.description} onChange={(e) => setBudgetForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Sound Hires" /></F>
            <F label="Nominal Code"><input className={inp} style={inpStyle} value={budgetForm.nominalCode} onChange={(e) => setBudgetForm((f) => ({ ...f, nominalCode: e.target.value }))} placeholder="e.g. 4100" /></F>
            <F label="Overall Allocation (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={budgetForm.budgeted} onChange={(e) => setBudgetForm((f) => ({ ...f, budgeted: e.target.value }))} /></F>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={budgetForm.notes} onChange={(e) => setBudgetForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={() => setShowBudgetForm(false)} />
          </form>
        </Modal>
      )}

      {/* Modal: Add / Edit Spend Item */}
      {showExpenseForm !== null && (
        <Modal title={editingExpense ? "Edit Spend" : "Add Spend"} onClose={() => { setShowExpenseForm(null); setEditingExpense(null); setExpenseForm(BLANK_EXPENSE); resetSpendDocState(); }}>
          <form onSubmit={saveExpense} className="space-y-4">
            {/* Core fields */}
            <F label="Phase">
              <select className={inp} style={inpStyle} value={expenseForm.phase} onChange={(e) => setExpenseForm((f) => ({ ...f, phase: e.target.value }))}>
                {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </F>
            <F label="Description *"><input required className={inp} style={inpStyle} value={expenseForm.description} onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))} /></F>
            <F label="Supplier"><input className={inp} style={inpStyle} value={expenseForm.supplier} onChange={(e) => setExpenseForm((f) => ({ ...f, supplier: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="PM Budget (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={expenseForm.estimated} onChange={(e) => setExpenseForm((f) => ({ ...f, estimated: e.target.value }))} /></F>
              <F label="Net Cost (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={expenseForm.committed} onChange={(e) => setExpenseForm((f) => ({ ...f, committed: e.target.value }))} /></F>
            </div>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={expenseForm.notes} onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))} /></F>

            {/* Quotes */}
            <div className="border-t pt-3" style={{ borderColor: "var(--psg-card-border)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>Quotes</span>
                <label className="cursor-pointer text-xs px-2 py-1 rounded border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                  + Upload
                  <input type="file" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files ?? []); setPendingQuotes(q => [...q, ...files]); e.target.value = ""; }} />
                </label>
              </div>
              <div
                className="rounded border-2 border-dashed mb-3 py-4 text-center text-xs transition-colors"
                style={{ borderColor: quoteDragOver ? "var(--psg-blue)" : "var(--psg-card-border)", backgroundColor: quoteDragOver ? "rgba(59,130,246,0.08)" : "transparent", color: "var(--psg-muted)" }}
                onDragOver={(e) => { e.preventDefault(); setQuoteDragOver(true); }}
                onDragLeave={() => setQuoteDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setQuoteDragOver(false); const files = Array.from(e.dataTransfer.files); if (files.length) setPendingQuotes(q => [...q, ...files]); }}
              >
                Drop quote files here
              </div>
              {existingDocs.filter(d => d.type === "quote").map(d => (
                <div key={d.id} className="flex items-center justify-between py-1.5 px-2 rounded text-xs mb-1" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                  <a href={`/api/spend-documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="truncate hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>{d.name}</a>
                  <button type="button" onClick={() => deleteSpendDoc(d.id)} className="ml-2 shrink-0 text-red-400 hover:text-red-300">×</button>
                </div>
              ))}
              {pendingQuotes.map((f, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-xs mb-1" style={{ backgroundColor: "rgba(59,130,246,0.08)" }}>
                  <span className="truncate text-blue-300">{f.name} <span style={{ color: "var(--psg-muted)" }}>(pending)</span></span>
                  <button type="button" onClick={() => setPendingQuotes(q => q.filter((_, j) => j !== i))} className="ml-2 shrink-0 text-red-400 hover:text-red-300">×</button>
                </div>
              ))}
            </div>

            {/* Approval + PO Number */}
            <div className="border-t pt-3" style={{ borderColor: "var(--psg-card-border)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>Approval</span>
                <button type="button" onClick={() => setShowApprovalModal(true)} className="text-xs px-2 py-1 rounded border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                  {expenseForm.approvedBy ? "Edit" : "+ Add Approval"}
                </button>
              </div>
              {expenseForm.approvedBy ? (
                <div className="text-xs rounded px-2 py-1.5 space-y-0.5 mb-3" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                  <p className="text-white">Approved by: <span style={{ color: "var(--psg-muted)" }}>{expenseForm.approvedBy}</span></p>
                  {expenseForm.approvedDate && <p className="text-white">Date: <span style={{ color: "var(--psg-muted)" }}>{expenseForm.approvedDate}</span></p>}
                  {expenseForm.approvalMethod && <p className="text-white">Method: <span style={{ color: "var(--psg-muted)" }}>{expenseForm.approvalMethod}</span></p>}
                </div>
              ) : (
                <p className="text-xs mb-3" style={{ color: "var(--psg-muted)" }}>No approval recorded</p>
              )}
              <F label="PO Number"><input className={inp} style={inpStyle} value={expenseForm.poNumber} onChange={(e) => setExpenseForm((f) => ({ ...f, poNumber: e.target.value }))} /></F>
            </div>

            {/* PO Upload */}
            <div className="border-t pt-3" style={{ borderColor: "var(--psg-card-border)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>Purchase Order</span>
                <label className="cursor-pointer text-xs px-2 py-1 rounded border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                  + Upload
                  <input type="file" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files ?? []); setPendingPO(p => [...p, ...files]); e.target.value = ""; }} />
                </label>
              </div>
              {existingDocs.filter(d => d.type === "po").map(d => (
                <div key={d.id} className="flex items-center justify-between py-1.5 px-2 rounded text-xs mb-1" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                  <a href={`/api/spend-documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="truncate hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>{d.name}</a>
                  <button type="button" onClick={() => deleteSpendDoc(d.id)} className="ml-2 shrink-0 text-red-400 hover:text-red-300">×</button>
                </div>
              ))}
              {pendingPO.map((f, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-xs mb-1" style={{ backgroundColor: "rgba(59,130,246,0.08)" }}>
                  <span className="truncate text-blue-300">{f.name} <span style={{ color: "var(--psg-muted)" }}>(pending)</span></span>
                  <button type="button" onClick={() => setPendingPO(p => p.filter((_, j) => j !== i))} className="ml-2 shrink-0 text-red-400 hover:text-red-300">×</button>
                </div>
              ))}
            </div>

            {/* Invoices */}
            <div className="border-t pt-3" style={{ borderColor: "var(--psg-card-border)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--psg-muted)" }}>Invoices</span>
                <label className="cursor-pointer text-xs px-2 py-1 rounded border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                  + Upload
                  <input type="file" multiple className="hidden" accept="application/pdf,image/*" onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) addInvoiceFiles(files); e.target.value = ""; }} />
                </label>
              </div>
              {/* Drag-and-drop zone */}
              <div
                className="rounded border-2 border-dashed mb-3 py-4 text-center text-xs transition-colors"
                style={{ borderColor: invoiceDragOver ? "var(--psg-blue)" : "var(--psg-card-border)", backgroundColor: invoiceDragOver ? "rgba(59,130,246,0.08)" : "transparent", color: "var(--psg-muted)" }}
                onDragOver={(e) => { e.preventDefault(); setInvoiceDragOver(true); }}
                onDragLeave={() => setInvoiceDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setInvoiceDragOver(false); const files = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf" || f.type.startsWith("image/")); if (files.length) addInvoiceFiles(files); }}
              >
                Drop PDF or image invoices here — data will be extracted automatically
              </div>
              {existingDocs.filter(d => d.type === "invoice").map(d => (
                <div key={d.id} className="rounded p-2 mb-2 space-y-1.5" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid var(--psg-card-border)" }}>
                  <div className="flex items-center justify-between">
                    <a href={`/api/spend-documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="text-xs truncate hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>{d.name}</a>
                    <button type="button" onClick={() => deleteSpendDoc(d.id)} className="ml-2 shrink-0 text-xs text-red-400 hover:text-red-300">×</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: "var(--psg-muted)" }}>Invoice No.</p>
                      <input type="text" placeholder="e.g. INV-001" className={inp + " text-xs py-1"} style={inpStyle}
                        value={d.invoiceNumber ?? ""}
                        onChange={(e) => patchSpendDoc(d.id, { invoiceNumber: e.target.value || null } as any)} />
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: "var(--psg-muted)" }}>Payment Due Date</p>
                      <input type="date" className={inp + " text-xs py-1"} style={inpStyle}
                        value={d.invoiceDate ? d.invoiceDate.slice(0, 10) : ""}
                        onChange={(e) => patchSpendDoc(d.id, { invoiceDate: e.target.value || null } as any)} />
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: "var(--psg-muted)" }}>Gross Amount (£)</p>
                      <input type="number" step="0.01" className={inp + " text-xs py-1"} style={inpStyle}
                        value={d.invoiceAmount ?? ""}
                        onChange={(e) => patchSpendDoc(d.id, { invoiceAmount: e.target.value ? Number(e.target.value) : null } as any)} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                    <input type="checkbox" checked={d.issuedForPayment}
                      onChange={(e) => patchSpendDoc(d.id, { issuedForPayment: e.target.checked })} />
                    Issued for Payment
                  </label>
                </div>
              ))}
              {pendingInvoices.map((inv, i) => (
                <div key={i} className="rounded p-2 mb-2 space-y-1.5" style={{ backgroundColor: inv.extracting ? "rgba(234,179,8,0.06)" : "rgba(59,130,246,0.06)", border: `1px solid ${inv.extracting ? "rgba(234,179,8,0.25)" : "rgba(59,130,246,0.2)"}` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs truncate" style={{ color: inv.extracting ? "rgb(234,179,8)" : "rgb(147,197,253)" }}>
                      {inv.file.name}
                      {inv.extracting ? <span className="ml-1 opacity-70">— extracting data…</span> : <span className="ml-1 opacity-60">(pending)</span>}
                    </span>
                    <button type="button" onClick={() => setPendingInvoices(a => a.filter((_, j) => j !== i))} className="ml-2 shrink-0 text-xs text-red-400 hover:text-red-300">×</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: "var(--psg-muted)" }}>Invoice No.</p>
                      <input type="text" placeholder="e.g. INV-001" className={inp + " text-xs py-1"} style={inpStyle}
                        value={inv.invoiceNumber}
                        onChange={(e) => setPendingInvoices(a => a.map((x, j) => j === i ? { ...x, invoiceNumber: e.target.value } : x))} />
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: "var(--psg-muted)" }}>Payment Due Date</p>
                      <input type="date" className={inp + " text-xs py-1"} style={inpStyle}
                        value={inv.invoiceDate}
                        onChange={(e) => setPendingInvoices(a => a.map((x, j) => j === i ? { ...x, invoiceDate: e.target.value } : x))} />
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: "var(--psg-muted)" }}>Gross Amount (£)</p>
                      <input type="number" step="0.01" className={inp + " text-xs py-1"} style={inpStyle}
                        value={inv.invoiceAmount}
                        onChange={(e) => setPendingInvoices(a => a.map((x, j) => j === i ? { ...x, invoiceAmount: e.target.value } : x))} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                    <input type="checkbox" checked={inv.issuedForPayment}
                      onChange={(e) => setPendingInvoices(a => a.map((x, j) => j === i ? { ...x, issuedForPayment: e.target.checked } : x))} />
                    Issued for Payment
                  </label>
                </div>
              ))}
              {(existingDocs.filter(d => d.type === "invoice").length > 0 || pendingInvoices.length > 0) && (
                <div className="text-xs text-right pt-1 font-medium text-white/60">
                  Gross Cost: £{(existingDocs.filter(d => d.type === "invoice").reduce((s, d) => s + (d.invoiceAmount ?? 0), 0) + pendingInvoices.reduce((s, inv) => s + (Number(inv.invoiceAmount) || 0), 0)).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </div>

            <Btns onCancel={() => { setShowExpenseForm(null); setEditingExpense(null); setExpenseForm(BLANK_EXPENSE); resetSpendDocState(); }} label={docsUploading ? "Saving…" : editingExpense ? "Save Changes" : "Add Spend"} />
          </form>
        </Modal>
      )}

      {/* Approval sub-modal */}
      {showApprovalModal && (
        <Modal title="Approval Details" onClose={() => setShowApprovalModal(false)}>
          <div className="space-y-3">
            <F label="Approved By"><input className={inp} style={inpStyle} value={expenseForm.approvedBy} onChange={(e) => setExpenseForm(f => ({ ...f, approvedBy: e.target.value }))} placeholder="Name or role" /></F>
            <F label="Approved Date"><input type="date" className={inp} style={inpStyle} value={expenseForm.approvedDate} onChange={(e) => setExpenseForm(f => ({ ...f, approvedDate: e.target.value }))} /></F>
            <F label="Approval Method"><input className={inp} style={inpStyle} value={expenseForm.approvalMethod} onChange={(e) => setExpenseForm(f => ({ ...f, approvalMethod: e.target.value }))} placeholder="e.g. Email, Board meeting, Verbal" /></F>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowApprovalModal(false)} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>Done</button>
              {expenseForm.approvedBy && (
                <button type="button" onClick={() => { setExpenseForm(f => ({ ...f, approvedBy: "", approvedDate: "", approvalMethod: "" })); setShowApprovalModal(false); }} className="border px-4 py-2 rounded text-sm text-red-400 hover:bg-red-900/20" style={{ borderColor: "rgba(248,113,113,0.3)" }}>Clear</button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Add / Edit PSG Expense */}
      {(showPSGExpenseForm !== null || editingPSGExpense !== null) && (
        <Modal title={editingPSGExpense ? "Edit PSG Expense" : "Add PSG Expense"} onClose={() => { setShowPSGExpenseForm(null); setEditingPSGExpense(null); setPSGExpenseForm(BLANK_PSG_EXPENSE); setPsgReceiptFile(null); }}>
          <form onSubmit={savePSGExpense} className="space-y-3">
            <F label="Description *"><input required className={inp} style={inpStyle} value={psgExpenseForm.description} onChange={(e) => setPSGExpenseForm(f => ({ ...f, description: e.target.value }))} /></F>
            <F label="Supplier"><input className={inp} style={inpStyle} value={psgExpenseForm.supplier} onChange={(e) => setPSGExpenseForm(f => ({ ...f, supplier: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Net Cost (£)"><input type="number" min="0" step="0.01" className={inp} style={inpStyle} value={psgExpenseForm.committed} onChange={(e) => setPSGExpenseForm(f => ({ ...f, committed: e.target.value }))} placeholder="0.00" /></F>
              <F label="Gross Cost (£)"><input type="number" min="0" step="0.01" className={inp} style={inpStyle} value={psgExpenseForm.spent} onChange={(e) => setPSGExpenseForm(f => ({ ...f, spent: e.target.value }))} placeholder="0.00" /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Payment Date"><input type="date" className={inp} style={inpStyle} value={psgExpenseForm.paymentDue} onChange={(e) => setPSGExpenseForm(f => ({ ...f, paymentDue: e.target.value }))} /></F>
              <F label="Payment Method">
                <select className={inp} style={inpStyle} value={["Soldo", "Personal Card", "PSG Trade Account", "TWS Trade Account"].includes(psgExpenseForm.paymentMethod) || psgExpenseForm.paymentMethod === "" ? psgExpenseForm.paymentMethod : "Other"} onChange={(e) => setPSGExpenseForm(f => ({ ...f, paymentMethod: e.target.value === "Other" ? "" : e.target.value }))}>
                  <option value="">— select —</option>
                  {["Soldo", "Personal Card", "PSG Trade Account", "TWS Trade Account", "Other"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {!["Soldo", "Personal Card", "PSG Trade Account", "TWS Trade Account", ""].includes(psgExpenseForm.paymentMethod) && (
                  <input className={`${inp} mt-1`} style={inpStyle} placeholder="Specify payment method…" value={psgExpenseForm.paymentMethod} onChange={(e) => setPSGExpenseForm(f => ({ ...f, paymentMethod: e.target.value }))} />
                )}
              </F>
            </div>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={psgExpenseForm.notes} onChange={(e) => setPSGExpenseForm(f => ({ ...f, notes: e.target.value }))} /></F>
            <F label="Receipt / Invoice">
              <input type="file" accept="image/*,application/pdf" className={inp} style={inpStyle} onChange={(e) => setPsgReceiptFile(e.target.files?.[0] ?? null)} />
              {psgReceiptFile && <p className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>{psgReceiptFile.name}</p>}
            </F>
            <Btns onCancel={() => { setShowPSGExpenseForm(null); setEditingPSGExpense(null); setPSGExpenseForm(BLANK_PSG_EXPENSE); setPsgReceiptFile(null); }} label={editingPSGExpense ? "Save Changes" : "Add PSG Expense"} />
          </form>
        </Modal>
      )}

      {/* ── TOUR STOPS TAB ── */}
      {tab === "tour" && prod.isTour && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Tour Schedule</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{tourStops.length} {tourStops.length === 1 ? "stop" : "stops"}</p>
            </div>
            <div className="flex items-center gap-2">
              {tourStops.length > 0 && (
                <>
                  <button
                    onClick={() => exportTourSchedulePDF(prod.name, tourStops, prod.logoUrl)}
                    className="text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors"
                    style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
                  >↓ PDF</button>
                  <button
                    onClick={() => exportTourScheduleXLSX(prod.name, tourStops)}
                    className="text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors"
                    style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
                  >↓ XLSX</button>
                </>
              )}
              <button
                onClick={() => { setEditStop(null); setStopForm(BLANK_STOP); setShowTourForm(true); }}
                className="text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors"
                style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
              >+ Add Stop</button>
            </div>
          </div>

          {showTourForm && (
            <form onSubmit={saveStop} className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-dark-bg)" }}>
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Venue *</label>
                <input
                  className={inp} style={inpStyle}
                  placeholder="Search venues…"
                  value={venueSearch}
                  onChange={e => setVenueSearch(e.target.value)}
                />
                {venueSearch.length > 0 && (
                  <div className="mt-1 rounded border overflow-hidden" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
                    {allVenues.filter(v => `${v.name} ${v.city ?? ""}`.toLowerCase().includes(venueSearch.toLowerCase())).slice(0, 8).map(v => (
                      <button key={v.id} type="button"
                        className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/10 ${stopForm.venueId === String(v.id) ? "bg-white/10 text-white" : ""}`}
                        style={{ color: stopForm.venueId === String(v.id) ? "white" : "var(--psg-muted)" }}
                        onClick={() => { setStopForm(f => ({ ...f, venueId: String(v.id) })); setVenueSearch(`${v.name}${v.city ? " · " + v.city : ""}`); }}
                      >
                        {v.name}{v.city ? ` · ${v.city}` : ""}{v.capacity ? ` · ${v.capacity.toLocaleString()} cap` : ""}
                      </button>
                    ))}
                    {allVenues.filter(v => `${v.name} ${v.city ?? ""}`.toLowerCase().includes(venueSearch.toLowerCase())).length === 0 && (
                      <p className="px-3 py-2 text-xs" style={{ color: "var(--psg-muted)" }}>No venues match</p>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Load-in date</label>
                  <input type="date" className={inp} style={inpStyle} value={stopForm.loadInDate} onChange={e => setStopForm(f => ({ ...f, loadInDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Get-out date</label>
                  <input type="date" className={inp} style={inpStyle} value={stopForm.endDate} onChange={e => setStopForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>First performance</label>
                  <input type="date" className={inp} style={inpStyle} value={stopForm.performanceStart} onChange={e => setStopForm(f => ({ ...f, performanceStart: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Last performance</label>
                  <input type="date" className={inp} style={inpStyle} value={stopForm.performanceEnd} onChange={e => setStopForm(f => ({ ...f, performanceEnd: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
                <textarea rows={4} className={inp} style={inpStyle} value={stopForm.notes} onChange={e => setStopForm(f => ({ ...f, notes: e.target.value }))} placeholder="Venue-specific show information, special requirements, contacts…" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 rounded text-sm text-white font-medium" style={{ backgroundColor: "var(--psg-blue)" }} disabled={!stopForm.venueId}>
                  {editStop ? "Save Changes" : "Add Stop"}
                </button>
                <button type="button" onClick={() => { setShowTourForm(false); setEditStop(null); setStopForm(BLANK_STOP); setVenueSearch(""); }} className="px-4 py-2 rounded text-sm border hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
              </div>
            </form>
          )}

          {tourStops.length === 0 && !showTourForm && (
            <p className="text-sm py-6 text-center" style={{ color: "var(--psg-muted)" }}>No tour stops added yet.</p>
          )}

          <div className="space-y-2">
            {tourStops.map((stop) => {
              const notesOpen = expandedStopNotes.has(stop.id);
              const draft = stopNoteDrafts[stop.id] ?? stop.notes ?? "";
              const toggleNotes = () => {
                setExpandedStopNotes(prev => {
                  const next = new Set(prev);
                  if (next.has(stop.id)) { next.delete(stop.id); } else {
                    next.add(stop.id);
                    setStopNoteDrafts(d => ({ ...d, [stop.id]: stop.notes ?? "" }));
                  }
                  return next;
                });
              };
              const saveNotes = async () => {
                const val = stopNoteDrafts[stop.id] ?? stop.notes ?? "";
                if (val === (stop.notes ?? "")) return;
                await fetch(`/api/tour-stops/${stop.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: val || null }) });
                reloadTourStops();
              };
              return (
                <div key={stop.id} className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
                  {/* Main row */}
                  <div className="flex items-start gap-4 p-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white" style={{ backgroundColor: "var(--psg-blue)" }}>
                      {stop.stopNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{stop.venue.name}</p>
                      <p className="text-xs" style={{ color: "var(--psg-muted)" }}>
                        {stop.venue.city ?? ""}
                        {stop.venue.capacity ? ` · ${stop.venue.capacity.toLocaleString()} cap` : ""}
                      </p>
                      {stop.loadInDate && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>Load in: {fmtDate(stop.loadInDate)}</p>
                      )}
                      {(stop.performanceStart || stop.performanceEnd) && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
                          Performances: {stop.performanceStart ? fmtDate(stop.performanceStart) : "?"}
                          {stop.performanceEnd && stop.performanceEnd !== stop.performanceStart ? ` → ${fmtDate(stop.performanceEnd)}` : ""}
                        </p>
                      )}
                      {stop.endDate && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>Get out: {fmtDate(stop.endDate)}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => exportVenueStopPDF(prod.name, stop, prod.logoUrl)}
                        className="text-xs px-2 py-1 rounded border hover:bg-white/5 transition-colors"
                        style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}
                        title="Export venue sheet as PDF"
                      >↓ PDF</button>
                      <button
                        onClick={toggleNotes}
                        className="text-xs px-2 py-1 rounded border hover:bg-white/5 transition-colors flex items-center gap-1"
                        style={{ borderColor: "var(--psg-card-border)", color: notesOpen ? "white" : "var(--psg-muted)" }}
                        title={notesOpen ? "Close notes" : "Open notes"}
                      >
                        Notes {stop.notes ? "●" : ""} {notesOpen ? "▲" : "▼"}
                      </button>
                      <button onClick={() => {
                        setEditStop(stop);
                        setStopForm({ venueId: String(stop.venueId), loadInDate: stop.loadInDate ? stop.loadInDate.slice(0, 10) : "", startDate: stop.startDate ? stop.startDate.slice(0, 10) : "", endDate: stop.endDate ? stop.endDate.slice(0, 10) : "", performanceStart: stop.performanceStart ? stop.performanceStart.slice(0, 10) : "", performanceEnd: stop.performanceEnd ? stop.performanceEnd.slice(0, 10) : "", notes: stop.notes ?? "" });
                        setVenueSearch(`${stop.venue.name}${stop.venue.city ? " · " + stop.venue.city : ""}`);
                        setShowTourForm(true);
                      }} className="text-xs px-2 py-1 rounded border hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Edit</button>
                      <button onClick={() => deleteStop(stop.id)} className="text-xs px-2 py-1 rounded border hover:bg-red-900/20 text-red-400" style={{ borderColor: "rgba(248,113,113,0.3)" }}>Remove</button>
                    </div>
                  </div>
                  {/* Notes dropdown */}
                  {notesOpen && (
                    <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--psg-card-border)" }}>
                      <p className="text-xs pt-3 mb-1.5 font-medium" style={{ color: "var(--psg-muted)" }}>Notes</p>
                      <textarea
                        rows={5}
                        className="w-full text-sm rounded px-3 py-2 resize-y"
                        style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid var(--psg-card-border)", color: "white", outline: "none" }}
                        placeholder="Venue-specific show information, special requirements, local contacts…"
                        value={draft}
                        onChange={e => setStopNoteDrafts(d => ({ ...d, [stop.id]: e.target.value }))}
                        onBlur={saveNotes}
                      />
                      <p className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>Auto-saves when you click away</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ADVANCING TAB ── */}
      {tab === "advancing" && (
        <AdvancingBoard tourStops={tourStops}
          onStatusChange={async (stopId, status) => {
            await fetch(`/api/tour-stops/${stopId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ advancingStatus: status }) });
            reloadTourStops();
          }}
          onContraChange={async (stopId, field, value) => {
            await fetch(`/api/tour-stops/${stopId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value === "" ? null : Number(value) }) });
            reloadTourStops();
          }}
        />
      )}

      {tab === "contacts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-white">Contacts</h2>
            <div className="flex items-center gap-2">
              {contacts.length > 0 && (
                <button onClick={() => exportContactSheetPDF(prod.name, contacts, prod.logoUrl)}
                  className="px-3 py-2 rounded text-sm border hover:bg-white/5 transition-colors"
                  style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                  ↓ Export PDF
                </button>
              )}
              <button onClick={() => { setEditContact(null); setContactForm(BLANK_CONTACT); setShowContactForm(true); }}
                className="px-4 py-2 rounded font-medium text-white text-sm" style={{ backgroundColor: "var(--psg-blue)" }}>
                + Add Contact
              </button>
            </div>
          </div>

          {contacts.length === 0 ? (
            <div className="rounded-xl border p-10 text-center text-sm" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
              No contacts yet — add people associated with this production.
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(new Set(contacts.map(c => c.section))).map(section => (
                <div key={section}>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--psg-muted)" }}>{section}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {contacts.filter(c => c.section === section).map((c) => (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => setDragContactId(c.id)}
                        onDragOver={e => { e.preventDefault(); }}
                        onDrop={() => {
                          if (dragContactId === null || dragContactId === c.id) return;
                          const draggedIdx = contacts.findIndex(x => x.id === dragContactId);
                          const targetIdx = contacts.findIndex(x => x.id === c.id);
                          if (draggedIdx === -1 || targetIdx === -1) return;
                          const next = [...contacts];
                          const [moved] = next.splice(draggedIdx, 1);
                          next.splice(targetIdx, 0, moved);
                          const updated = next.map((x, i) => ({ ...x, sortOrder: i }));
                          setContacts(updated);
                          setDragContactId(null);
                          fetch(`/api/productions/${id}/contacts/reorder`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ order: updated.map(x => ({ id: x.id, sortOrder: x.sortOrder })) }),
                          });
                        }}
                        onDragEnd={() => setDragContactId(null)}
                        className={`rounded-xl border p-4 space-y-1 relative group cursor-grab active:cursor-grabbing transition-opacity ${dragContactId === c.id ? "opacity-40" : ""}`}
                        style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}
                      >
                        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-30 transition-opacity text-xs select-none" style={{ color: "var(--psg-muted)" }}>⠿</div>
                        <div className="font-medium text-white text-sm pl-3">{c.name}</div>
                        {c.role && <div className="text-xs pl-3" style={{ color: "var(--psg-blue)" }}>{c.role}</div>}
                        {c.company && <div className="text-xs pl-3" style={{ color: "var(--psg-muted)" }}>{c.company}</div>}
                        {c.phone && <a href={`tel:${c.phone}`} className="block text-xs pl-3 hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>📞 {c.phone}</a>}
                        {c.email && <a href={`mailto:${c.email}`} className="block text-xs pl-3 hover:text-white transition-colors truncate" style={{ color: "var(--psg-muted)" }}>✉ {c.email}</a>}
                        {c.notes && <div className="text-xs pl-3 pt-1 border-t" style={{ color: "var(--psg-muted)", borderColor: "var(--psg-card-border)" }}>{c.notes}</div>}
                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditContact(c); setContactForm({ section: c.section, name: c.name, company: c.company ?? "", role: c.role ?? "", phone: c.phone ?? "", email: c.email ?? "", notes: c.notes ?? "" }); setShowContactForm(true); }}
                            className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors" style={{ color: "var(--psg-muted)" }}>Edit</button>
                          <button onClick={() => deleteContact(c.id)}
                            className="text-xs px-2 py-1 rounded hover:bg-red-900/20 transition-colors text-red-400">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showContactForm && (
            <Modal title={editContact ? "Edit Contact" : "Add Contact"} onClose={() => { setShowContactForm(false); setEditContact(null); }}>
              <form onSubmit={saveContact} className="space-y-3">
                <F label="Section">
                  {(() => {
                    const existingSections = Array.from(new Set(contacts.map(c => c.section)));
                    const presets = ["General", "Creative Team", "Production Team", "Cast", "Venue", "Press & Marketing", "Transport & Haulage"];
                    const allOptions = Array.from(new Set([...existingSections, ...presets]));
                    const isCustom = contactForm.section && !allOptions.includes(contactForm.section);
                    return (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {allOptions.map(s => (
                            <button key={s} type="button"
                              onClick={() => setContactForm(f => ({ ...f, section: s }))}
                              className="px-2.5 py-1 rounded-full text-xs border transition-colors"
                              style={{
                                borderColor: contactForm.section === s ? "var(--psg-blue)" : "var(--psg-card-border)",
                                backgroundColor: contactForm.section === s ? "rgba(59,130,246,0.15)" : "transparent",
                                color: contactForm.section === s ? "var(--psg-blue)" : "var(--psg-muted)",
                              }}>
                              {s}
                            </button>
                          ))}
                          <button type="button"
                            onClick={() => setContactForm(f => ({ ...f, section: "" }))}
                            className="px-2.5 py-1 rounded-full text-xs border transition-colors"
                            style={{
                              borderColor: isCustom || contactForm.section === "" ? "var(--psg-blue)" : "var(--psg-card-border)",
                              backgroundColor: isCustom || contactForm.section === "" ? "rgba(59,130,246,0.15)" : "transparent",
                              color: isCustom || contactForm.section === "" ? "var(--psg-blue)" : "var(--psg-muted)",
                            }}>
                            + Custom
                          </button>
                        </div>
                        {(isCustom || contactForm.section === "") && (
                          <input autoFocus className={inp} style={inpStyle} value={contactForm.section} onChange={e => setContactForm(f => ({ ...f, section: e.target.value }))} placeholder="Section name…" />
                        )}
                      </div>
                    );
                  })()}
                </F>
                <F label="Name *"><input required className={inp} style={inpStyle} value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} /></F>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Role / Title"><input className={inp} style={inpStyle} value={contactForm.role} onChange={e => setContactForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Director, Producer" /></F>
                  <F label="Company"><input className={inp} style={inpStyle} value={contactForm.company} onChange={e => setContactForm(f => ({ ...f, company: e.target.value }))} /></F>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Phone"><input type="tel" className={inp} style={inpStyle} value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} /></F>
                  <F label="Email"><input type="email" className={inp} style={inpStyle} value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} /></F>
                </div>
                <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={contactForm.notes} onChange={e => setContactForm(f => ({ ...f, notes: e.target.value }))} /></F>
                <Btns onCancel={() => { setShowContactForm(false); setEditContact(null); }} label={editContact ? "Save Changes" : "Add Contact"} />
              </form>
            </Modal>
          )}
        </div>
      )}

      {/* ── SHOW REPORTS TAB ── */}
      {tab === "reports" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Show Reports</h3>
              {prod.reportEmail && (
                <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>Reports sent to: {prod.reportEmail}</p>
              )}
            </div>
            <button onClick={() => { setEditReport(null); setReportForm(BLANK_REPORT); setShowReportForm(true); }}
              className="text-sm px-3 py-1.5 rounded font-medium text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--psg-blue)" }}>+ Add Report</button>
          </div>

          {showReportForm && (
            <div className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-blue)" }}>
              <h4 className="text-sm font-semibold text-white">{editReport ? "Edit Report" : "New Show Report"}</h4>
              <form onSubmit={saveReport} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <F label="Date *"><input required type="date" className={inp} style={inpStyle} value={reportForm.reportDate} onChange={e => setReportForm(f => ({ ...f, reportDate: e.target.value }))} /></F>
                  <F label="Performance"><input className={inp} style={inpStyle} placeholder="e.g. Evening – 7:30pm" value={reportForm.performance} onChange={e => setReportForm(f => ({ ...f, performance: e.target.value }))} /></F>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Venue"><input className={inp} style={inpStyle} value={reportForm.venue} onChange={e => setReportForm(f => ({ ...f, venue: e.target.value }))} /></F>
                  <F label="Attendance"><input type="number" min="0" className={inp} style={inpStyle} value={reportForm.attendance} onChange={e => setReportForm(f => ({ ...f, attendance: e.target.value }))} /></F>
                </div>
                <F label="Notes"><textarea rows={4} className={inp} style={inpStyle} value={reportForm.notes} onChange={e => setReportForm(f => ({ ...f, notes: e.target.value }))} /></F>
                <Btns onCancel={() => { setShowReportForm(false); setEditReport(null); setReportForm(BLANK_REPORT); }} label={editReport ? "Save Changes" : "Save Report"} />
              </form>
            </div>
          )}

          {showReports.length === 0 && !showReportForm ? (
            <div className="py-12 text-center rounded-lg border" style={{ color: "var(--psg-muted)", borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
              No show reports yet.{prod.reportEmail ? "" : " Add a report email in Edit Production to set a distribution address."}
            </div>
          ) : (
            <div className="rounded-lg border divide-y overflow-hidden" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
              {showReports.map(r => (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white text-sm">{fmtDate(r.reportDate)}</span>
                        {r.performance && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{r.performance}</span>}
                        {r.venue && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "var(--psg-blue)" }}>{r.venue}</span>}
                        {r.attendance != null && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>Attendance: {r.attendance.toLocaleString()}</span>}
                      </div>
                      {r.notes && <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: "var(--psg-muted)" }}>{r.notes}</p>}
                      {r.createdByUser && <p className="text-xs mt-1" style={{ color: "var(--psg-muted)", opacity: 0.6 }}>by {r.createdByUser.name}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditReport(r); setReportForm({ reportDate: r.reportDate.slice(0, 10), venue: r.venue ?? "", performance: r.performance ?? "", attendance: r.attendance != null ? String(r.attendance) : "", notes: r.notes ?? "" }); setShowReportForm(true); }}
                        className="text-xs px-2 py-1 rounded" style={{ color: "var(--psg-blue)", backgroundColor: "rgba(59,130,246,0.1)" }}>Edit</button>
                      <button onClick={() => deleteReport(r.id)}
                        className="text-xs px-2 py-1 rounded" style={{ color: "#f87171", backgroundColor: "rgba(239,68,68,0.1)" }}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "tasks" && prod && (
        <TasksPanel productionId={prod.id} />
      )}

      {/* Modal: Edit Production */}
      {editProd && (
        <Modal title="Edit Production" onClose={() => setEditProd(false)}>
          <form onSubmit={saveProd} className="space-y-3">
            <F label="Name *"><input required className={inp} style={inpStyle} value={prodForm.name} onChange={(e) => setProdForm((f) => ({ ...f, name: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Type"><input className={inp} style={inpStyle} value={prodForm.type} onChange={(e) => setProdForm((f) => ({ ...f, type: e.target.value }))} /></F>
              <F label="Status"><select className={inp} style={inpStyle} value={prodForm.status} onChange={(e) => setProdForm((f) => ({ ...f, status: e.target.value }))}>{STATUS_OPTS.map((s) => <option key={s}>{s}</option>)}</select></F>
              <F label="Announcement"><select className={inp} style={inpStyle} value={prodForm.announcementStatus} onChange={(e) => setProdForm((f) => ({ ...f, announcementStatus: e.target.value }))}>{ANN_OPTS.map((s) => <option key={s} value={s}>{ANN_LABELS[s]}</option>)}</select></F>
            </div>
            <F label="Venue (from database)">
              <select className={inp} style={inpStyle} value={prodForm.venueId} onChange={e => setProdForm(f => ({ ...f, venueId: e.target.value }))}>
                <option value="">— none / freetext below —</option>
                {allVenues.map(v => <option key={v.id} value={v.id}>{v.name}{v.city ? ` · ${v.city}` : ""}</option>)}
              </select>
            </F>
            <F label="Venue (freetext override)"><input className={inp} style={inpStyle} value={prodForm.venue} onChange={(e) => setProdForm((f) => ({ ...f, venue: e.target.value }))} placeholder="Leave blank if using venue above" /></F>
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input type="checkbox" checked={prodForm.isTour} onChange={e => setProdForm(f => ({ ...f, isTour: e.target.checked }))} />
              This is a touring production
            </label>
            <div className="grid grid-cols-2 gap-3">
              <F label="Start Date"><input type="date" className={inp} style={inpStyle} value={prodForm.startDate} onChange={(e) => setProdForm((f) => ({ ...f, startDate: e.target.value }))} /></F>
              <F label="End Date"><input type="date" className={inp} style={inpStyle} value={prodForm.endDate} onChange={(e) => setProdForm((f) => ({ ...f, endDate: e.target.value }))} /></F>
            </div>
            <F label="Calendar Colour">
              <div className="flex items-center gap-2 flex-wrap">
                {["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899","#84cc16","#f97316","#a855f7"].map(c => (
                  <button key={c} type="button" onClick={() => setProdForm(f => ({ ...f, color: c }))}
                    className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: prodForm.color === c ? "white" : "transparent" }} />
                ))}
                <input type="color" value={prodForm.color || "#3b82f6"} onChange={e => setProdForm(f => ({ ...f, color: e.target.value }))}
                  className="w-6 h-6 rounded cursor-pointer border-0 p-0" title="Custom colour" style={{ backgroundColor: "transparent" }} />
              </div>
            </F>
            <F label="Show Report Email"><input type="email" className={inp} style={inpStyle} value={prodForm.reportEmail} onChange={(e) => setProdForm((f) => ({ ...f, reportEmail: e.target.value }))} placeholder="reports@example.com" /></F>
            <F label="SharePoint Folder URL"><input type="url" className={inp} style={inpStyle} value={prodForm.sharepointUrl} onChange={(e) => setProdForm((f) => ({ ...f, sharepointUrl: e.target.value }))} placeholder="https://..." /></F>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={prodForm.notes} onChange={(e) => setProdForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--psg-muted)" }}>Production Logo</label>
              <div className="flex items-center gap-3">
                {prod.logoUrl && (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border shrink-0" style={{ borderColor: "var(--psg-card-border)" }}>
                    <Image src={prod.logoUrl} alt={prod.name} fill className="object-contain p-1" />
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="cursor-pointer text-xs px-3 py-1.5 rounded border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                    {logoUploading ? "Uploading…" : prod.logoUrl ? "Replace logo" : "Upload logo"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                  </label>
                  {prod.logoUrl && (
                    <button type="button" onClick={removeLogo} className="text-xs px-3 py-1.5 rounded border transition-colors text-red-400 hover:bg-red-900/20" style={{ borderColor: "rgba(248,113,113,0.3)" }}>Remove</button>
                  )}
                </div>
              </div>
            </div>
            <Btns onCancel={() => setEditProd(false)} label="Save Changes" />
          </form>
        </Modal>
      )}
    </div>
  );
}

const ADVANCING_COLUMNS = [
  { key: "triage",           label: "Triage",              color: "#6b7280" },
  { key: "rider_released",   label: "Rider Released",      color: "#b45309" },
  { key: "contra_in",        label: "Contra Estimate In",  color: "#1d4ed8" },
  { key: "plans_drawn",      label: "Plans Drawn",         color: "#6d28d9" },
  { key: "email_released",   label: "Full Email Released", color: "#0e7490" },
  { key: "in_venue",         label: "In Venue",            color: "#15803d" },
  { key: "closed",           label: "Closed / Pre Contra", color: "#b91c1c" },
];

function AdvancingBoard({ tourStops, onStatusChange, onContraChange }: {
  tourStops: TourStop[];
  onStatusChange: (stopId: number, status: string) => Promise<void>;
  onContraChange: (stopId: number, field: "contraEstimate" | "contraActual", value: string) => Promise<void>;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [contraEdits, setContraEdits] = useState<Record<string, string>>({});
  const [contraOpen, setContraOpen] = useState<Record<number, boolean>>({});;

  if (tourStops.length === 0) {
    return <div className="p-6 text-sm" style={{ color: "var(--psg-muted)" }}>No tour stops yet — add them in Tour Stops first.</div>;
  }

  function fmtDate(s: string | null) {
    if (!s) return null;
    return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  return (
    <div className="p-4 overflow-x-auto">
      <div className="flex gap-3 min-w-max">
        {ADVANCING_COLUMNS.map(col => {
          const stops = tourStops.filter(s => (s.advancingStatus || "triage") === col.key);
          return (
            <div
              key={col.key}
              className="flex flex-col rounded-lg w-52 shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--psg-card-border)" }}
              onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={async e => {
                e.preventDefault();
                setDragOver(null);
                const stopId = Number(e.dataTransfer.getData("stopId"));
                if (stopId) await onStatusChange(stopId, col.key);
              }}
            >
              {/* Column header */}
              <div
                className="px-3 py-2.5 rounded-t-lg flex items-center justify-between"
                style={{ backgroundColor: col.color + "22", borderBottom: `2px solid ${col.color}` }}
              >
                <span className="text-xs font-semibold" style={{ color: col.color }}>{col.label}</span>
                <span className="text-xs rounded-full px-1.5 py-0.5 font-medium" style={{ backgroundColor: col.color + "33", color: col.color }}>{stops.length}</span>
              </div>

              {/* Drop highlight */}
              <div
                className="flex-1 p-2 space-y-2 min-h-20 transition-colors rounded-b-lg"
                style={{ backgroundColor: dragOver === col.key ? col.color + "11" : undefined }}
              >
                {stops
                  .sort((a, b) => a.stopNumber - b.stopNumber)
                  .map(stop => (
                    <div
                      key={stop.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData("stopId", String(stop.id)); setDragging(stop.id); }}
                      onDragEnd={() => setDragging(null)}
                      className="rounded-lg p-2.5 cursor-grab active:cursor-grabbing select-none transition-opacity"
                      style={{
                        backgroundColor: "var(--psg-card-bg)",
                        border: "1px solid var(--psg-card-border)",
                        opacity: dragging === stop.id ? 0.4 : 1,
                      }}
                    >
                      <div className="text-xs font-semibold text-white mb-0.5">
                        {stop.stopNumber} · {stop.venue.name}
                      </div>
                      {stop.venue.city && <div className="text-xs" style={{ color: "var(--psg-muted)" }}>{stop.venue.city}</div>}
                      {(stop.loadInDate || stop.startDate) && (
                        <div className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>
                          {fmtDate(stop.loadInDate ?? stop.startDate)}
                          {stop.endDate ? ` – ${fmtDate(stop.endDate)}` : ""}
                        </div>
                      )}
                      {/* Contra fields */}
                      <div className="mt-2" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setContraOpen(o => ({ ...o, [stop.id]: !o[stop.id] }))}
                          className="flex items-center gap-1 text-xs transition-colors hover:text-white"
                          style={{ color: (stop.contraEstimate != null || stop.contraActual != null) ? "#fde047" : "var(--psg-muted)" }}
                        >
                          <span>{contraOpen[stop.id] ? "▾" : "▸"}</span>
                          <span>Contra{stop.contraEstimate != null ? ` £${stop.contraEstimate.toLocaleString()}` : ""}{stop.contraActual != null ? ` / £${stop.contraActual.toLocaleString()}` : ""}</span>
                        </button>
                        {contraOpen[stop.id] && (
                          <div className="mt-1.5 space-y-1">
                            {(["contraEstimate", "contraActual"] as const).map(field => {
                              const key = `${stop.id}-${field}`;
                              const label = field === "contraEstimate" ? "Est." : "Act.";
                              const color = field === "contraEstimate" ? "#fde047" : "#fb923c";
                              const stored = stop[field];
                              const editing = contraEdits[key] !== undefined;
                              return (
                                <div key={field} className="flex items-center gap-1.5">
                                  <span className="text-xs w-6 shrink-0" style={{ color: "var(--psg-muted)" }}>{label}</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="flex-1 text-xs rounded px-1.5 py-1 w-full"
                                    style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid var(--psg-card-border)", color, outline: "none", minWidth: 0 }}
                                    value={editing ? contraEdits[key] : (stored != null ? String(stored) : "")}
                                    placeholder="—"
                                    onFocus={() => setContraEdits(c => ({ ...c, [key]: stored != null ? String(stored) : "" }))}
                                    onChange={e => setContraEdits(c => ({ ...c, [key]: e.target.value }))}
                                    onBlur={async () => {
                                      const val = contraEdits[key] ?? "";
                                      setContraEdits(c => { const n = { ...c }; delete n[key]; return n; });
                                      if (val !== (stored != null ? String(stored) : "")) {
                                        await onContraChange(stop.id, field, val);
                                      }
                                    }}
                                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProductionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <ProductionPageInner params={params} />
    </Suspense>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
          <h2 className="font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-xl leading-none hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>×</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Btns({ onCancel, label = "Save" }: { onCancel: () => void; label?: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>{label}</button>
      <button type="button" onClick={onCancel} className="border px-4 py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
    </div>
  );
}
