"use client";

// Types, constants and small building blocks shared by the production page and its tabs.

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

// ── Types ──

export type SpendDoc = { id: number; type: string; name: string; mime: string; invoiceDate: string | null; invoiceAmount: number | null; invoiceNumber: string | null; issuedForPayment: boolean; createdAt: string };
export type ProdDoc = { id: number; name: string; mime: string; folder: string; createdAt: string };
export type ProdLink = { id: number; title: string; url: string; description: string | null; createdAt: string };
export type HSDoc = { id: number; name: string; mime: string; folder: string; tourStopId: number | null; createdAt: string };
export type ToolboxSig = { id: number; tourStopId: number | null; venueName: string | null; signeeName: string; signeeDate: string; employer: string | null; position: string | null; agreedBriefing: boolean; agreedSafety: boolean; createdAt: string };
export type Expense = {
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
export type BudgetLine = {
  id: number;
  department: string;
  description: string;
  nominalCode: string | null;
  budgeted: number;
  notes: string | null;
  expenses: Expense[];
};
export type HotelInfo = { id: number; name: string; city: string | null };
export type HotelBooking = {
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
export type CrewMember = {
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
export type ProductionCrew = {
  id: number;
  crewId: number;
  crew: CrewMember;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  dayRate: number | null;
  notes: string | null;
};
export type Event = {
  id: number;
  title: string;
  type: string;
  startAt: string;
  endAt: string;
  location: string | null;
  notes: string | null;
};
export type HaulageMovement = {
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
export type TeamMember = { user: { id: number; name: string; email: string; role: string } };
export type VenueRef = { id: number; name: string; city: string | null; capacity: number | null };
export type PerfSchedule = { weekPattern: number; matineePattern: number } | null;
export type PerfOverride = { id: number; date: string; type: string };
export type TourStop = { id: number; venueId: number; venue: VenueRef; stopNumber: number; advancingStatus: string; contraEstimate: number | null; contraActual: number | null; loadInDate: string | null; startDate: string | null; endDate: string | null; performanceStart: string | null; performanceEnd: string | null; notes: string | null };
export type ProdContact = { id: number; section: string; sortOrder: number; name: string; company: string | null; role: string | null; phone: string | null; email: string | null; notes: string | null };
export type Production = {
  id: number;
  name: string;
  contactSections?: string | null;
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
  advancingStatus: string;
  contraEstimate: number | null;
  contraActual: number | null;
  bdClientId: number | null;
  bdClient: { id: number; name: string; type: string; address: string | null; website: string | null; billingName: string | null; billingAddress: string | null; billingEmail: string | null } | null;
  events: Event[];
  budgetLines: BudgetLine[];
  crew: ProductionCrew[];
  hotelBookings: HotelBooking[];
  haulageMovements: HaulageMovement[];
  productionDocuments: ProdDoc[];
  productionLinks: ProdLink[];
  hsDocuments: HSDoc[];
  toolboxSignatures: ToolboxSig[];
  tourStops: { id: number; stopNumber: number; venue: { id: number; name: string; city: string | null } }[];
  team: TeamMember[];
};

export type TabKey = "schedule" | "budget" | "crew" | "accommodation" | "haulage" | "callsheets" | "advancing" | "contacts" | "documents" | "links" | "hs" | "reports" | "tasks" | "tour" | "notes" | "meetings";

/** What every tab gets from the page: the production, and a way to refetch it after a change. */
export type TabProps = {
  prod: Production;
  setProd: Dispatch<SetStateAction<Production | null>>;
  reload: () => Promise<void>;
};

// ── Constants ──

export const STATUS_OPTS = ["planning", "in-production", "closed"];

export const STATUS_COLORS: Record<string, string> = {
  planning: "bg-yellow-900/60 text-yellow-300",
  "in-production": "bg-green-900/60 text-green-300",
  closed: "bg-white/10 text-white/40",
};

export const ANN_COLORS: Record<string, string> = {
  nda: "bg-red-900/60 text-red-300",
  not_announced: "bg-orange-900/50 text-orange-300",
  on_sale: "bg-blue-900/60 text-blue-300",
  open: "bg-green-900/60 text-green-300",
};
export const ANN_LABELS: Record<string, string> = {
  nda: "NDA", not_announced: "Not Announced", on_sale: "On Sale", open: "Open",
};
export const ANN_OPTS = ["nda", "not_announced", "on_sale", "open"];

export const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
export const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

// ── Formatting ──

export function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}
export function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
export function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
export function fmtShortDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
/** "2026-11-23" → "23/11/2026" */
export function fmtIsoDay(d: string) {
  return d.split("-").reverse().join("/");
}

export function fileIcon(mime: string) {
  if (mime.includes("pdf")) return "📄";
  if (mime.includes("image")) return "🖼️";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return "📊";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  return "📎";
}
export function shortName(name: string) {
  return name.length > 32 ? name.slice(0, 30) + "…" : name;
}

// ── Data helpers ──

/** Sends a JSON body (PUT/POST/PATCH). */
export function sendJson(url: string, method: "POST" | "PUT" | "PATCH", body: unknown) {
  return fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

/** Loads a JSON array from `url` when the component mounts; `reload` fetches it again. Non-array responses are ignored. */
export function useList<T>(url: string) {
  const [items, setItems] = useState<T[]>([]);
  const reload = useCallback(async () => {
    const data = await fetch(url).then((r) => r.json());
    if (Array.isArray(data)) setItems(data);
  }, [url]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
  useEffect(() => { reload(); }, [reload]);
  return [items, setItems, reload] as const;
}

/** Returns a copy of `set` with `value` added or removed. */
export function toggled<T>(set: Set<T>, value: T) {
  const n = new Set(set);
  if (n.has(value)) n.delete(value); else n.add(value);
  return n;
}

/** Opens the browser file picker and passes the chosen files on. */
export function pickFiles(onFiles: (files: File[]) => void, accept?: string) {
  const el = document.createElement("input");
  el.type = "file";
  if (accept) el.accept = accept;
  el.multiple = true;
  el.onchange = (e) => { const files = Array.from((e.target as HTMLInputElement).files ?? []); if (files.length) onFiles(files); };
  el.click();
}

// Drag-over highlight for drop zones that style themselves directly rather than through state
type DragEl = React.DragEvent<HTMLElement>;
export function dragHighlight(e: DragEl, bg: string) {
  e.preventDefault();
  e.currentTarget.style.borderColor = "var(--psg-blue)";
  e.currentTarget.style.backgroundColor = bg;
}
export function dragUnhighlight(e: DragEl) {
  e.currentTarget.style.borderColor = "var(--psg-card-border)";
  e.currentTarget.style.backgroundColor = "";
}

// ── UI building blocks ──

export function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
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

export function Btns({ onCancel, label = "Save" }: { onCancel: () => void; label?: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>{label}</button>
      <button type="button" onClick={onCancel} className="border px-4 py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
    </div>
  );
}

export function NoAccess() {
  return <div className="py-20 text-center" style={{ color: "var(--psg-muted)" }}>You don&apos;t have access to this section.</div>;
}

/** Collapsible folder header used by the Documents and H&S tabs. `sub` is the smaller nested style. */
export function FolderToggle({ icon, title, count, badge, open, onToggle, sub }: {
  icon: string; title: string; count: React.ReactNode; badge?: string; open: boolean; onToggle: () => void; sub?: boolean;
}) {
  return (
    <button onClick={onToggle} className={`w-full ${sub ? "px-3 py-2.5 flex items-center gap-2" : "px-4 py-3 flex items-center gap-3"} text-left hover:bg-white/5 transition-colors`} style={{ borderBottom: open ? "1px solid var(--psg-card-border)" : "none" }}>
      <span className={sub ? "text-base" : "text-lg"}>{icon}</span>
      <span className={sub ? "text-sm font-medium text-white" : "font-semibold text-white text-sm"}>{title}</span>
      <span className="text-xs ml-1" style={{ color: "var(--psg-muted)" }}>{count}</span>
      {badge && <span className="text-xs ml-1 px-1.5 py-0.5 rounded" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.05)" }}>{badge}</span>}
      <span className="ml-auto text-xs" style={{ color: "var(--psg-muted)" }}>{open ? "▾" : "▸"}</span>
    </button>
  );
}

/** Grid of uploaded files with a click-or-drop upload zone underneath (Documents and H&S tabs). */
export function FileGrid<D extends { id: number; name: string; mime: string; createdAt: string }>({ docs, href, onDelete, onUpload, uploading }: {
  docs: D[]; href: (doc: D) => string; onDelete: (id: number) => void; onUpload: (files: File[]) => void; uploading: boolean;
}) {
  return (
    <div className="space-y-3">
      {docs.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-white/5 transition-colors group relative" style={{ borderColor: "var(--psg-card-border)" }}>
              <a href={href(doc)} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-2xl shrink-0">{fileIcon(doc.mime)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate" title={doc.name}>{shortName(doc.name)}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{new Date(doc.createdAt).toLocaleDateString("en-GB")}</p>
                </div>
              </a>
              <button onClick={() => onDelete(doc.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 text-xs shrink-0">×</button>
            </div>
          ))}
        </div>
      )}
      {docs.length === 0 && <p className="text-xs text-center py-4" style={{ color: "var(--psg-muted)" }}>No files yet</p>}
      <div
        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors"
        style={{ borderColor: "var(--psg-card-border)" }}
        onClick={() => pickFiles(onUpload)}
        onDragOver={(e) => dragHighlight(e, "rgba(59,130,246,0.06)")}
        onDragLeave={dragUnhighlight}
        onDrop={(e) => { e.preventDefault(); dragUnhighlight(e); const files = Array.from(e.dataTransfer.files); if (files.length) onUpload(files); }}
      >
        {uploading
          ? <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Uploading…</p>
          : <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Drop files here or click to upload</p>}
      </div>
    </div>
  );
}
