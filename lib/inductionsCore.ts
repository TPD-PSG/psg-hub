// Machine inductions (26 Nov 2026): the plain rules, shared by routes, pages and tests. No imports.

export const DUE_SOON_DAYS = 30;
const DAY = 86400e3;

/** The refresher date: `months` after the induction (end-of-month safe), or null when none is needed. */
export function refresherDate(inductedAt: Date, months: number): Date | null {
  if (!months || months <= 0) return null;
  const d = new Date(Date.UTC(inductedAt.getUTCFullYear(), inductedAt.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(inductedAt.getUTCDate(), last));
  return d;
}

export type InductionLike = { inductedAt: Date | string; expiresAt: Date | string | null; revokedAt: Date | string | null };
export type Status = "valid" | "due" | "expired" | "none";

/** valid · due (refresher within 30 days, still counts) · expired · none (never, or withdrawn). */
export function inductionStatus(i: InductionLike | null | undefined, now = new Date()): Status {
  if (!i || i.revokedAt) return "none";
  if (!i.expiresAt) return "valid";
  const left = new Date(i.expiresAt).getTime() - now.getTime();
  return left < 0 ? "expired" : left <= DUE_SOON_DAYS * DAY ? "due" : "valid";
}
/** Counts for using the machine today: valid, or due soon. */
export const inducted = (s: Status) => s === "valid" || s === "due";

/** The induction that counts for a person on a machine: the latest one not withdrawn. */
export function current<T extends InductionLike>(list: T[]): T | null {
  return list.filter(i => !i.revokedAt).sort((a, b) => new Date(b.inductedAt).getTime() - new Date(a.inductedAt).getTime())[0] ?? null;
}

/** A person, whether a Hub user or someone recorded by name. */
export const personKey = (p: { userId: number | null; personName: string }) => (p.userId ? `u${p.userId}` : `n${p.personName.trim().toLowerCase()}`);

/** Which of `machineIds` this person isn't inducted on (never, withdrawn or lapsed). */
export function missing<T extends InductionLike & { machineId: number }>(theirs: T[], machineIds: number[], now = new Date()): number[] {
  return machineIds.filter(id => !inducted(inductionStatus(current(theirs.filter(i => i.machineId === id)), now)));
}

export const STATUS_LABEL: Record<Status, string> = { valid: "Inducted", due: "Refresher due", expired: "Lapsed", none: "Not inducted" };
