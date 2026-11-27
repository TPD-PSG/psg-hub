// Compliance register (26 Nov 2026): the plain rules, shared by routes, pages and tests.
import { daysUntilUk, dueState } from "./dateRules.ts";

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

export type ComplianceStatus = "valid" | "due" | "expired" | "undated";
/** The date that matters: renewal for most things, review for policies. */
export const keyDate = <T extends Date | string>(i: { expiresAt: T | null; reviewAt: T | null }): T | null => i.expiresAt ?? i.reviewAt ?? null;

export function complianceStatus(i: { expiresAt: Date | string | null; reviewAt: Date | string | null }, now = new Date()): ComplianceStatus {
  return dueState(keyDate(i), DUE_SOON_DAYS, now);
}
export const STATUS_LABEL: Record<ComplianceStatus, string> = { valid: "In date", due: "Due soon", expired: "Expired", undated: "No date" };

/** Whole UK calendar days from today to `d` (the shared rule). */
export const daysUntil = (d: Date | string, today = new Date()) => daysUntilUk(d, today);
