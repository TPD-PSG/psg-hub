// Compliance register (26 Nov 2026): the plain rules, shared by routes, pages and tests. No imports.

export const COMPLIANCE_CATEGORIES = [
  ["insurance", "Insurances"],
  ["accreditation", "Accreditations"],
  ["policy", "Policies"],
  ["certificate", "Certificates"],
  ["registration", "Registrations"],
  ["other", "Other"],
] as const;
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(COMPLIANCE_CATEGORIES);
export const isCategory = (c: unknown): c is string => typeof c === "string" && COMPLIANCE_CATEGORIES.some(([k]) => k === c);

/** Days before a renewal or review when the owner and admins are reminded (and on the day). */
export const REMIND_DAYS = [60, 30, 7, 0];
export const DUE_SOON_DAYS = 60;
const DAY = 86400e3;

export type ComplianceStatus = "valid" | "due" | "expired" | "undated";
/** The date that matters: renewal for most things, review for policies. */
export const keyDate = <T extends Date | string>(i: { expiresAt: T | null; reviewAt: T | null }): T | null => i.expiresAt ?? i.reviewAt ?? null;

export function complianceStatus(i: { expiresAt: Date | string | null; reviewAt: Date | string | null }, now = new Date()): ComplianceStatus {
  const d = keyDate(i);
  if (!d) return "undated";
  const left = new Date(d).getTime() - now.getTime();
  return left < 0 ? "expired" : left <= DUE_SOON_DAYS * DAY ? "due" : "valid";
}
export const STATUS_LABEL: Record<ComplianceStatus, string> = { valid: "In date", due: "Due soon", expired: "Expired", undated: "No date" };

/** Whole days from the start of `today` (UTC) to `d`. */
export function daysUntil(d: Date | string, today = new Date()) {
  const a = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const x = new Date(d);
  return Math.round((Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()) - a) / DAY);
}
