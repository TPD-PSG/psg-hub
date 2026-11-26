// Equipment checks (26 Nov 2026): the plain rules, shared by routes, pages and tests. No imports.

export const CATEGORIES = [
  ["machine", "Machines"],
  ["power_tool", "Power tools & electricals"],
  ["lifting", "Lifting gear"],
  ["access", "Ladders & access"],
  ["fire", "Fire & first aid"],
  ["coshh", "Substances (COSHH)"],
  ["other", "Other kit"],
] as const;
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES);
export const isCategory = (c: unknown): c is string => typeof c === "string" && CATEGORIES.some(([k]) => k === c);

// Check kinds, with the usual interval in months (a starting point: the workshop sets its own)
export const CHECK_KINDS = [
  ["pat", "PAT test", 12],
  ["service", "Service", 12],
  ["thorough_exam", "Thorough examination (LOLER)", 6],
  ["inspection", "Inspection", 3],
  ["coshh", "COSHH assessment review", 12],
  ["calibration", "Calibration", 12],
  ["other", "Other check", 12],
] as const;
export const KIND_LABEL: Record<string, string> = Object.fromEntries(CHECK_KINDS.map(([k, l]) => [k, l]));
export const isKind = (k: unknown): k is string => typeof k === "string" && CHECK_KINDS.some(([v]) => v === k);

/** The checks a new item of each category usually needs. */
export const USUAL_CHECKS: Record<string, { kind: string; intervalMonths: number }[]> = {
  machine: [{ kind: "service", intervalMonths: 12 }, { kind: "pat", intervalMonths: 12 }],
  power_tool: [{ kind: "pat", intervalMonths: 12 }],
  lifting: [{ kind: "thorough_exam", intervalMonths: 6 }],
  access: [{ kind: "inspection", intervalMonths: 3 }],
  fire: [{ kind: "service", intervalMonths: 12 }],
  coshh: [{ kind: "coshh", intervalMonths: 12 }],
  other: [],
};

export const DUE_SOON_DAYS = 30;
const DAY = 86400e3;

/** `months` after `from`, end-of-month safe; null when the interval is 0. */
export function addMonths(from: Date, months: number): Date | null {
  if (!months || months <= 0) return null;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(from.getUTCDate(), last));
  return d;
}

type Rec = { doneAt: Date | string; passed: boolean; nextDue: Date | string | null };
export type CheckStatus = "ok" | "due" | "overdue" | "failed" | "never";

/** One check's state from its records (latest first or not: sorted here). */
export function checkState(check: { firstDue: Date | string | null }, records: Rec[], now = new Date()): { status: CheckStatus; due: Date | null; last: Rec | null } {
  const last = [...records].sort((a, b) => new Date(b.doneAt).getTime() - new Date(a.doneAt).getTime())[0] ?? null;
  if (last && !last.passed) return { status: "failed", due: null, last };
  const due = last ? (last.nextDue ? new Date(last.nextDue) : null) : check.firstDue ? new Date(check.firstDue) : null;
  if (!last && !due) return { status: "never", due: null, last };
  if (!due) return { status: "ok", due: null, last };
  const left = due.getTime() - now.getTime();
  return { status: left < 0 ? "overdue" : left <= DUE_SOON_DAYS * DAY ? "due" : "ok", due, last };
}

export type ItemStatus = "out" | "overdue" | "due" | "ok";
/** The whole item: out of use (by hand or a failed check), overdue, due soon, or fine. */
export function itemState(item: { outOfUseAt: Date | string | null }, checks: CheckStatus[]): ItemStatus {
  if (item.outOfUseAt || checks.includes("failed")) return "out";
  if (checks.includes("overdue")) return "overdue";
  // "never": no record and no due date yet (just added): asks for the last check, doesn't stop use
  if (checks.includes("due") || checks.includes("never")) return "due";
  return "ok";
}
export const ITEM_LABEL: Record<ItemStatus, string> = { out: "Out of use", overdue: "Check overdue", due: "Check due soon", ok: "OK" };
/** Shouldn't be used until sorted: out of use, or a check overdue. */
export const unusable = (s: ItemStatus) => s === "out" || s === "overdue";
