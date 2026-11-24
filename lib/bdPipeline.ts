// BD pipeline rules shared by the BD page, its API and the Director forecast.
// Decided 24 Nov 2026: stage weights 10/25/50/75%, a deal may set its own %, and a deal is
// "stuck" when its follow-up date has passed, or it has none and nothing has happened for 21 days.

export const STAGES = [
  { key: "lead", label: "Lead", color: "#6b7280", weight: 10 },
  { key: "qualified", label: "Qualified", color: "#3b82f6", weight: 25 },
  { key: "proposal", label: "Proposal", color: "#8b5cf6", weight: 50 },
  { key: "negotiating", label: "Negotiating", color: "#f59e0b", weight: 75 },
  { key: "won", label: "Won", color: "#10b981", weight: 100 },
  { key: "lost", label: "Lost", color: "#ef4444", weight: 0 },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];
export const STAGE_KEYS = STAGES.map(s => s.key) as readonly string[];
export const stageLabel = (key: string) => STAGES.find(s => s.key === key)?.label ?? key;
export const isOpen = (stage: string) => stage !== "won" && stage !== "lost";

export const STUCK_AFTER_DAYS = 21;
export const LEAD_SOURCES = ["Referral", "Repeat client", "Tender", "Website", "Event or networking", "Ammonite", "Cold approach", "Other"];
export const ACTIVITY_KINDS = [
  { key: "note", label: "Note" },
  { key: "call", label: "Call" },
  { key: "email", label: "Email" },
  { key: "meeting", label: "Meeting" },
] as const;

type DealLike = { stage: string; value: number | null; probability?: number | null };

/** The % of this deal's value that counts in the weighted pipeline. */
export function weightPct(d: DealLike): number {
  if (d.stage === "won") return 100;
  if (d.stage === "lost") return 0;
  if (d.probability != null) return Math.max(0, Math.min(100, d.probability));
  return STAGES.find(s => s.key === d.stage)?.weight ?? 0;
}

export const weightedValue = (d: DealLike) => ((d.value ?? 0) * weightPct(d)) / 100;

type StuckLike = { stage: string; followUpDate?: string | Date | null; lastActivityAt?: string | Date | null; updatedAt?: string | Date | null; createdAt?: string | Date | null };

/** Why an open deal needs attention, or null when it doesn't. */
export function stuckReason(d: StuckLike, now = new Date()): string | null {
  if (!isOpen(d.stage)) return null;
  if (d.followUpDate) {
    const due = new Date(d.followUpDate);
    // A follow-up is due at the end of its day
    const endOfDay = new Date(due.getTime() + 24 * 3600e3 - 1);
    return endOfDay < now ? "Follow-up overdue" : null;
  }
  const last = d.lastActivityAt ?? d.createdAt;
  if (!last) return null;
  const days = Math.floor((now.getTime() - new Date(last).getTime()) / 86400e3);
  return days >= STUCK_AFTER_DAYS ? `Nothing for ${days} days` : null;
}
