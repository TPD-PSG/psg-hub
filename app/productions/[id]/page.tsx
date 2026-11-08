"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import ExportMenu from "@/components/ExportMenu";
import { exportBudgetPDF, exportBudgetXLSX, exportSchedulePDF, exportScheduleXLSX, exportCrewPDF, exportCrewXLSX, exportAccommodationPDF, exportAccommodationXLSX, exportHaulagePDF, exportHaulageXLSX } from "@/lib/exports";

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
};
type BudgetLine = {
  id: number;
  department: string;
  description: string;
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
  insuranceExpiry: string | null;
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
};
type Production = {
  id: number;
  name: string;
  type: string;
  venue: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  notes: string | null;
  events: Event[];
  budgetLines: BudgetLine[];
  crew: ProductionCrew[];
  hotelBookings: HotelBooking[];
  haulageMovements: HaulageMovement[];
};

const EVENT_TYPES = ["Rehearsal", "Tech", "Dress Rehearsal", "Performance", "Meeting", "Workshop", "Other"];
const DEPARTMENTS = ["Scenery", "Props", "Wardrobe", "Wigs & Hair", "Makeup", "Sound Hires", "Sound Consumables", "Lighting Hires", "Lighting Consumables", "Rigging", "Instruments", "Video Hires", "Video Consumables", "Video Content", "Production Setup", "Transport", "Rehearsal", "Production Staffing", "Petty Cash", "Other"];
const PHASES = ["pre-production", "running", "closing"];
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

const PHASE_COLORS: Record<string, string> = {
  "pre-production": "text-yellow-400",
  running: "text-green-400",
  closing: "text-blue-400",
};

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

const BLANK_EXPENSE = { phase: "pre-production", description: "", estimated: "", committed: "", spent: "", poNumber: "", paymentDue: "", issuedForPayment: false, vatExempt: false, supplier: "", notes: "" };

export default function ProductionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [prod, setProd] = useState<Production | null>(null);
  const [tab, setTab] = useState<"schedule" | "budget" | "crew" | "accommodation" | "haulage">("schedule");
  const BLANK_MOVEMENT = { haulageCompany: "", driverName: "", vehicleInfo: "", fromLocation: "", toLocation: "", departureAt: "", arrivalAt: "", cargo: "", notes: "" };
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

  const [showEventForm, setShowEventForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState<number | null>(null);
  const [editProd, setEditProd] = useState(false);

  const [eventForm, setEventForm] = useState({ title: "", type: "Rehearsal", startAt: "", endAt: "", location: "", notes: "" });
  const [budgetForm, setBudgetForm] = useState({ department: "Scenery", description: "", budgeted: "", notes: "" });
  const [expenseForm, setExpenseForm] = useState<typeof BLANK_EXPENSE & { id?: number }>(BLANK_EXPENSE);
  const [prodForm, setProdForm] = useState({ name: "", type: "", venue: "", startDate: "", endDate: "", status: "", notes: "" });

  useEffect(() => {
    reload();
    fetch("/api/crew").then((r) => r.json()).then(setAllCrew);
    fetch("/api/hotels").then((r) => r.json()).then(setAllHotels);
  }, [id]);

  async function reload() {
    const data = await fetch(`/api/productions/${id}`).then((r) => r.json());
    setProd(data);
    setProdForm({
      name: data.name, type: data.type, venue: data.venue ?? "",
      startDate: data.startDate ? data.startDate.slice(0, 10) : "",
      endDate: data.endDate ? data.endDate.slice(0, 10) : "",
      status: data.status, notes: data.notes ?? "",
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
    setBudgetForm({ department: "Scenery", description: "", budgeted: "", notes: "" });
    reload();
  }

  async function deleteBudgetLine(lid: number) {
    if (!confirm("Delete this budget line and all its items?")) return;
    await fetch(`/api/budget-lines/${lid}`, { method: "DELETE" });
    reload();
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    if (expenseForm.id) {
      await fetch(`/api/expenses/${expenseForm.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(expenseForm) });
    } else {
      await fetch(`/api/budget-lines/${showExpenseForm}/expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(expenseForm) });
    }
    setShowExpenseForm(null);
    setEditingExpense(null);
    setExpenseForm(BLANK_EXPENSE);
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
    });
    setEditingExpense(exp);
    setShowExpenseForm(lineId);
  }

  async function deleteExpense(eid: number) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/expenses/${eid}`, { method: "DELETE" });
    reload();
  }

  async function toggleIssued(exp: Expense) {
    await fetch(`/api/expenses/${exp.id}`, {
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

  function openEditMovement(m: HaulageMovement) {
    setMovementForm({ ...m, id: m.id, driverName: m.driverName ?? "", vehicleInfo: m.vehicleInfo ?? "", departureAt: m.departureAt.slice(0, 16), arrivalAt: m.arrivalAt ? m.arrivalAt.slice(0, 16) : "", cargo: m.cargo ?? "", notes: m.notes ?? "" });
    setEditMovement(m);
    setShowMovementForm(true);
  }

  if (!prod) return <div className="py-20 text-center" style={{ color: "var(--psg-muted)" }}>Loading…</div>;

  const totalEstimated = prod.budgetLines.reduce((s, l) => s + l.expenses.reduce((e, x) => e + x.estimated, 0), 0);
  const totalCommitted = prod.budgetLines.reduce((s, l) => s + l.expenses.reduce((e, x) => e + x.committed, 0), 0);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{prod.name}</h1>
            <span className="text-sm" style={{ color: "var(--psg-muted)" }}>{prod.type}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[prod.status] ?? "bg-white/10 text-white/50"}`}>{prod.status}</span>
          </div>
          {prod.venue && <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>{prod.venue}</p>}
          {(prod.startDate || prod.endDate) && (
            <p className="text-xs mt-1" style={{ color: "var(--psg-muted)" }}>
              {prod.startDate ? fmtDate(prod.startDate) : "?"} → {prod.endDate ? fmtDate(prod.endDate) : "?"}
            </p>
          )}
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
          { label: "Estimated", value: totalEstimated, color: "text-yellow-300" },
          { label: "Committed", value: totalCommitted, color: "text-orange-300" },
          { label: "Spent", value: totalSpent, color: totalSpent > totalBudgeted ? "text-red-400" : "text-green-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border p-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--psg-muted)" }}>{label}</p>
            <p className={`text-xl font-bold ${color}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
        {(["schedule", "budget", "crew", "accommodation", "haulage"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="pb-2 text-sm font-medium capitalize border-b-2 transition-colors"
            style={tab === t
              ? { borderColor: "var(--psg-blue)", color: "var(--psg-text)" }
              : { borderColor: "transparent", color: "var(--psg-muted)" }}
          >
            {t === "schedule" ? `Schedule (${prod.events.length})` : t === "budget" ? `Budget (${prod.budgetLines.length} lines)` : t === "crew" ? `Crew (${prod.crew.length})` : t === "accommodation" ? `Accommodation (${prod.hotelBookings.length})` : `Haulage (${prod.haulageMovements.length})`}
          </button>
        ))}
      </div>

      {/* ── SCHEDULE TAB ── */}
      {tab === "schedule" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <ExportMenu actions={[
              { label: "Export PDF", onClick: () => exportSchedulePDF(prod.name, prod.events) },
              { label: "Export Excel", onClick: () => exportScheduleXLSX(prod.name, prod.events) },
            ]} />
            <button onClick={() => setShowEventForm(true)} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
              + Add Event
            </button>
          </div>
          {prod.events.length === 0 && <p className="text-center py-10" style={{ color: "var(--psg-muted)" }}>No events yet.</p>}
          <div className="space-y-2">
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
                { label: "Export PDF", onClick: () => exportBudgetPDF(prod.name, prod.budgetLines) },
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
                    <th className="px-4 py-3 text-right font-medium text-yellow-300">Estimated</th>
                    <th className="px-4 py-3 text-right font-medium text-orange-300">Committed</th>
                    <th className="px-4 py-3 text-right font-medium text-green-400">Spent</th>
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
                      <td className={`px-4 py-2.5 text-right font-medium ${s.budgeted - s.spent < 0 ? "text-red-400" : "text-white/60"}`}>
                        {fmt(s.budgeted - s.spent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.05)" }}>
                    <td className="px-4 py-3 font-semibold text-white">TOTAL</td>
                    <td className="px-4 py-3 text-right font-semibold text-white">{fmt(totalBudgeted)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-yellow-300">{fmt(totalEstimated)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-300">{fmt(totalCommitted)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400">{fmt(totalSpent)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${totalBudgeted - totalSpent < 0 ? "text-red-400" : "text-white/60"}`}>
                      {fmt(totalBudgeted - totalSpent)}
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
                const lineEst = line.expenses.reduce((s, x) => s + x.estimated, 0);
                const lineCom = line.expenses.reduce((s, x) => s + x.committed, 0);
                const lineSpt = line.expenses.reduce((s, x) => s + x.spent, 0);
                const pct = line.budgeted > 0 ? Math.min((lineSpt / line.budgeted) * 100, 100) : 0;
                const byPhase = PHASES.reduce((acc, p) => {
                  acc[p] = line.expenses.filter((x) => x.phase === p);
                  return acc;
                }, {} as Record<string, Expense[]>);

                return (
                  <div key={line.id} className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
                    {/* Department header */}
                    <div className="px-4 py-3 flex items-center justify-between gap-4" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderBottom: "1px solid var(--psg-card-border)" }}>
                      <div>
                        <span className="font-semibold text-sm text-white">{line.description}</span>
                        <span className="ml-2 text-xs" style={{ color: "var(--psg-muted)" }}>{line.department}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs shrink-0">
                        <span className="text-yellow-300">Est: {fmt(lineEst)}</span>
                        <span className="text-orange-300">Com: {fmt(lineCom)}</span>
                        <span className="text-green-400">Spt: {fmt(lineSpt)}</span>
                        <span style={{ color: "var(--psg-muted)" }}>/ {fmt(line.budgeted)}</span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => { setExpenseForm(BLANK_EXPENSE); setShowExpenseForm(line.id); }} className="text-xs border px-2 py-1 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-text)" }}>+ Item</button>
                        <button onClick={() => deleteBudgetLine(line.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </div>
                    {/* Budget bar */}
                    <div className="h-1" style={{ backgroundColor: "var(--psg-card-border)" }}>
                      <div className={`h-full transition-all ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-400" : "bg-green-400"}`} style={{ width: `${pct}%` }} />
                    </div>

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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CREW TAB ── */}
      {tab === "crew" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <ExportMenu actions={[
              { label: "Export PDF", onClick: () => exportCrewPDF(prod.name, prod.crew.map((pc) => pc.crew)) },
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
                { label: "Export PDF", onClick: () => exportAccommodationPDF(prod.name, prod.hotelBookings) },
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
              { label: "Export PDF", onClick: () => exportHaulagePDF(prod.name, prod.haulageMovements) },
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
            <F label="Department"><select className={inp} style={inpStyle} value={budgetForm.department} onChange={(e) => setBudgetForm((f) => ({ ...f, department: e.target.value }))}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></F>
            <F label="Description *"><input required className={inp} style={inpStyle} value={budgetForm.description} onChange={(e) => setBudgetForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Sound Hires" /></F>
            <F label="Overall Allocation (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={budgetForm.budgeted} onChange={(e) => setBudgetForm((f) => ({ ...f, budgeted: e.target.value }))} /></F>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={budgetForm.notes} onChange={(e) => setBudgetForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={() => setShowBudgetForm(false)} />
          </form>
        </Modal>
      )}

      {/* Modal: Add / Edit Expense Item */}
      {showExpenseForm !== null && (
        <Modal title={editingExpense ? "Edit Item" : "Add Budget Item"} onClose={() => { setShowExpenseForm(null); setEditingExpense(null); setExpenseForm(BLANK_EXPENSE); }}>
          <form onSubmit={saveExpense} className="space-y-3">
            <F label="Phase">
              <select className={inp} style={inpStyle} value={expenseForm.phase} onChange={(e) => setExpenseForm((f) => ({ ...f, phase: e.target.value }))}>
                {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </F>
            <F label="Description *"><input required className={inp} style={inpStyle} value={expenseForm.description} onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))} /></F>
            <F label="Supplier"><input className={inp} style={inpStyle} value={expenseForm.supplier} onChange={(e) => setExpenseForm((f) => ({ ...f, supplier: e.target.value }))} /></F>
            <div className="grid grid-cols-3 gap-3">
              <F label="Estimated (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={expenseForm.estimated} onChange={(e) => setExpenseForm((f) => ({ ...f, estimated: e.target.value }))} /></F>
              <F label="Committed (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={expenseForm.committed} onChange={(e) => setExpenseForm((f) => ({ ...f, committed: e.target.value }))} /></F>
              <F label="Spent (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={expenseForm.spent} onChange={(e) => setExpenseForm((f) => ({ ...f, spent: e.target.value }))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="PO Number"><input className={inp} style={inpStyle} value={expenseForm.poNumber} onChange={(e) => setExpenseForm((f) => ({ ...f, poNumber: e.target.value }))} /></F>
              <F label="Payment Due"><input type="date" className={inp} style={inpStyle} value={expenseForm.paymentDue} onChange={(e) => setExpenseForm((f) => ({ ...f, paymentDue: e.target.value }))} /></F>
            </div>
            <div className="flex gap-6 text-sm text-white">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={expenseForm.issuedForPayment} onChange={(e) => setExpenseForm((f) => ({ ...f, issuedForPayment: e.target.checked }))} />
                Issued for Payment
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={expenseForm.vatExempt} onChange={(e) => setExpenseForm((f) => ({ ...f, vatExempt: e.target.checked }))} />
                VAT Exempt
              </label>
            </div>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={expenseForm.notes} onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={() => { setShowExpenseForm(null); setEditingExpense(null); setExpenseForm(BLANK_EXPENSE); }} label={editingExpense ? "Save Changes" : "Add Item"} />
          </form>
        </Modal>
      )}

      {/* Modal: Edit Production */}
      {editProd && (
        <Modal title="Edit Production" onClose={() => setEditProd(false)}>
          <form onSubmit={saveProd} className="space-y-3">
            <F label="Name *"><input required className={inp} style={inpStyle} value={prodForm.name} onChange={(e) => setProdForm((f) => ({ ...f, name: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Type"><input className={inp} style={inpStyle} value={prodForm.type} onChange={(e) => setProdForm((f) => ({ ...f, type: e.target.value }))} /></F>
              <F label="Status"><select className={inp} style={inpStyle} value={prodForm.status} onChange={(e) => setProdForm((f) => ({ ...f, status: e.target.value }))}>{STATUS_OPTS.map((s) => <option key={s}>{s}</option>)}</select></F>
            </div>
            <F label="Venue"><input className={inp} style={inpStyle} value={prodForm.venue} onChange={(e) => setProdForm((f) => ({ ...f, venue: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Start Date"><input type="date" className={inp} style={inpStyle} value={prodForm.startDate} onChange={(e) => setProdForm((f) => ({ ...f, startDate: e.target.value }))} /></F>
              <F label="End Date"><input type="date" className={inp} style={inpStyle} value={prodForm.endDate} onChange={(e) => setProdForm((f) => ({ ...f, endDate: e.target.value }))} /></F>
            </div>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={prodForm.notes} onChange={(e) => setProdForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={() => setEditProd(false)} label="Save Changes" />
          </form>
        </Modal>
      )}
    </div>
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
