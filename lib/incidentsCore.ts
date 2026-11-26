// Accident & incident reporting (26 Nov 2026): the plain rules, shared by routes, pages and tests.
// No imports, so tests can load it directly.

export const INCIDENT_KINDS = [
  ["accident", "Accident (someone hurt)"],
  ["near_miss", "Near miss (no one hurt)"],
  ["dangerous_occurrence", "Dangerous occurrence"],
  ["ill_health", "Ill health"],
  ["property_damage", "Damage to kit or building"],
] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number][0];
export const KIND_LABEL: Record<string, string> = Object.fromEntries(INCIDENT_KINDS.map(([k, l]) => [k, l.replace(/ \(.*\)$/, "")]));
export const isKind = (k: unknown): k is IncidentKind => typeof k === "string" && INCIDENT_KINDS.some(([v]) => v === k);

export const TREATMENTS = [
  ["none", "None needed"],
  ["first_aid", "First aid on site"],
  ["doctor", "Went to a GP / doctor"],
  ["hospital", "Went to hospital"],
  ["ambulance", "Ambulance called"],
] as const;
export const TREATMENT_LABEL: Record<string, string> = Object.fromEntries(TREATMENTS);

export const INJURED_ROLES = ["Crew", "Cast", "Production team", "Venue staff", "Contractor", "Member of the public", "Other"];

// RIDDOR 2013: what kind of report it is, and how long there is to make it.
// Specified injuries, dangerous occurrences, and members of the public taken to hospital: without delay,
// and within 10 days. Over-7-day incapacitation: within 15 days of the incident. Diseases: on diagnosis.
export const RIDDOR = [
  ["no", "Not reportable", null],
  ["specified", "Specified injury to a worker (e.g. fracture, amputation, loss of sight)", 10],
  ["over7", "Worker off or on light duties for more than 7 days", 15],
  ["public_hospital", "Member of the public taken straight to hospital", 10],
  ["dangerous", "Dangerous occurrence (e.g. collapse of lifting gear or scaffold)", 10],
  ["disease", "Reportable occupational disease", 10],
  ["death", "Death", 10],
] as const;
export const RIDDOR_LABEL: Record<string, string> = Object.fromEntries(RIDDOR.map(([k, l]) => [k, l]));
export const isRiddor = (k: unknown) => typeof k === "string" && RIDDOR.some(([v]) => v === k);
const DAY = 86400e3;

/** When the RIDDOR report is due, or null when it isn't reportable (or not decided yet). */
export function riddorDue(kind: string | null | undefined, occurredAt: Date): Date | null {
  const row = RIDDOR.find(([v]) => v === kind);
  if (!row || row[2] == null) return null;
  return new Date(occurredAt.getTime() + row[2] * DAY);
}

/** A hint for the reviewer: which reports probably need a RIDDOR decision. Never decides on its own. */
export function riddorHint(i: { kind: string; treatment?: string | null; offWork?: boolean; injuredRole?: string | null }): string | null {
  if (i.kind === "dangerous_occurrence") return "Dangerous occurrences are often reportable under RIDDOR.";
  if (i.kind !== "accident" && i.kind !== "ill_health") return null;
  if (i.injuredRole === "Member of the public" && (i.treatment === "hospital" || i.treatment === "ambulance")) return "A member of the public went to hospital: check whether RIDDOR applies.";
  if (i.offWork) return "They're off work: if it runs past 7 days it's reportable under RIDDOR.";
  if (i.treatment === "hospital" || i.treatment === "ambulance") return "Hospital treatment: check for a specified injury under RIDDOR.";
  return null;
}

export const incidentRef = (i: { year: number; number: number }) => `INC-${i.year}-${String(i.number).padStart(3, "0")}`;

export type IncidentStatus = "open" | "investigating" | "closed";
export const STATUS_LABEL: Record<string, string> = { open: "Open", investigating: "Investigating", closed: "Closed" };

/** What's stopping a report being closed: actions not done, RIDDOR not decided or not yet reported. */
export function closeBlockers(i: { riddor: string | null; riddorReportedAt: Date | string | null; actions: { doneAt: Date | string | null }[] }): string[] {
  const out: string[] = [];
  if (!i.riddor) out.push("Decide whether it's reportable under RIDDOR");
  else if (i.riddor !== "no" && !i.riddorReportedAt) out.push("Record when it was reported to the HSE");
  const open = i.actions.filter(a => !a.doneAt).length;
  if (open) out.push(`${open} action${open === 1 ? "" : "s"} still open`);
  return out;
}

type ForStats = { kind: string; occurredAt: Date | string; status: string; productionName: string; riddor: string | null; riddorDueDate: Date | string | null; riddorReportedAt: Date | string | null };

/** Figures for the central page: last 12 months by month and kind, by show, and what's due. */
export function incidentStats(list: ForStats[], now = new Date()) {
  const months: { key: string; label: string; count: number; byKind: Record<string, number> }[] = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }), count: 0, byKind: {} });
  }
  const byKind: Record<string, number> = {};
  const byShow = new Map<string, number>();
  let riddorDueSoon = 0, riddorOverdue = 0;
  for (const i of list) {
    const at = new Date(i.occurredAt);
    const m = months.find(x => x.key === at.toISOString().slice(0, 7));
    if (m) {
      m.count++; m.byKind[i.kind] = (m.byKind[i.kind] ?? 0) + 1;
      byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;
      byShow.set(i.productionName, (byShow.get(i.productionName) ?? 0) + 1);
    }
    if (i.riddor && i.riddor !== "no" && !i.riddorReportedAt && i.riddorDueDate) {
      const due = new Date(i.riddorDueDate).getTime();
      if (due < now.getTime()) riddorOverdue++; else if (due - now.getTime() < 3 * DAY) riddorDueSoon++;
    }
  }
  return {
    months, byKind,
    byShow: [...byShow].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    open: list.filter(i => i.status !== "closed").length,
    last30: list.filter(i => now.getTime() - new Date(i.occurredAt).getTime() < 30 * DAY).length,
    riddorDueSoon, riddorOverdue,
  };
}
