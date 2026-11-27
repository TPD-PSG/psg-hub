// Shared types, form blanks, constants and small helpers for the Business Development screen.
import { fmtDate as fmtDateShared } from "@/lib/format";
import { splitFee, type FeeStageInput } from "@/lib/feeStages";

export const fmtDate = (s: string | null) => (s ? fmtDateShared(s) : null);

export type Client = {
  id: number; name: string; type: string; website?: string | null; address?: string | null; notes?: string | null;
  billingName?: string | null; billingAddress?: string | null; billingEmail?: string | null;
  targetAccount?: boolean; targetOwner?: { id: number; name: string } | null; targetSource?: string | null;
  opportunities?: { id: number; stage: string }[];
};
export type BDTask = { id: number; description: string; dueDate: string | null; completedAt: string | null };
export type Opportunity = {
  id: number; title: string; type: string; stage: string;
  value: number | null; clientId: number | null; client: Client | null;
  description: string | null; closeDate: string | null; lostReason: string | null; notes: string | null;
  tasks: BDTask[]; createdAt: string; updatedAt: string;
  entityId: number | null; entity: { id: number; name: string } | null;
  ownerUserId: number | null; owner: { id: number; name: string } | null;
  probability: number | null; followUpDate: string | null; tenderDeadline?: string | null; leadSource: string | null; competitor: string | null;
  stageChangedAt: string | null; productionId: number | null; production: { id: number; name: string } | null;
  job?: { id: number; number: string } | null;
  lastActivityAt: string | null;
};
export type EntityOption = { id: number; name: string; archived: boolean };
export type UserOption = { id: number; name: string; role?: string };
export type Activity = { id: number; kind: string; text: string; at: string; user: { id: number; name: string } | null };

export const OPP_TYPES = ["production","event","scenic","rental","acquisition","f&b","other"];
export const CLIENT_TYPES = ["promoter","venue","council","broadcaster","corporate","other"];

export const BLANK_OPP = {
  title: "", type: "production", stage: "lead", value: "", clientId: "", description: "", closeDate: "", notes: "",
  entityId: "", ownerUserId: "", probability: "", followUpDate: "", tenderDeadline: "", leadSource: "", competitor: "", lostReason: "",
};
export const BLANK_ACTIVITY = { kind: "note", text: "", followUpDate: "" };
export const PRODUCTION_TYPES = ["Play", "Musical", "Opera", "Dance", "Comedy", "Drama", "Physical Theatre", "Event", "Other"];
export type ConvertForm = { name: string; type: string; venue: string; startDate: string; endDate: string; pmFee: string; stages: { label: string; amount: string; dueDate: string }[] };
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const stagesFor = (fee: string, startDate: string) =>
  splitFee(Number(fee) || 0, { today: todayIso(), startDate: startDate || null }).map((s: FeeStageInput) => ({ label: s.label, amount: String(s.amount), dueDate: s.dueDate ?? "" }));
export const BLANK_TASK = { description: "", dueDate: "" };
export const BLANK_CLIENT = { name: "", type: "promoter", website: "", address: "", notes: "", billingName: "", billingAddress: "", billingEmail: "" };
export const BLANK_CONTACT = { name: "", role: "", email: "", phone: "" };

export const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
export const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

export function fmtValue(v: number | null) {
  if (!v) return null;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(v);
}
export function isOverdue(s: string | null) {
  if (!s) return false;
  return new Date(s) < new Date();
}

export type BDInitial = { opps: Opportunity[]; clients: Client[]; entities: EntityOption[]; users: UserOption[] } | null;

// A quote listed in the open deal's panel
export type DealQuote = { id: number; number: string; status: string; totals: { net: number } };
