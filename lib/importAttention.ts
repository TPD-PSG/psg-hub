// Show-report emails the import couldn't use: not matched to a Hub show, no PDF, or unreadable.
// Each full scheduled run replaces the list, so it always shows what's still sitting unread in
// the reports inbox. Admins see it in Hub Settings (via /api/admin/status, never /api/settings).
import type { PrismaClient } from "@prisma/client";

export const ATTENTION_KEY = "report-import:attention";
/** Settings keys the app keeps for itself; /api/settings doesn't hand them out. */
export const INTERNAL_SETTING_PREFIXES = ["job:", "job-alert:", "report-import:"];

export type AttentionReason = "no_match" | "no_pdf" | "unreadable";
export type AttentionItem = { subject: string; from: string | null; receivedAt: string | null; reason: AttentionReason; detail?: string };
export type Attention = { at: string; items: AttentionItem[] };

type Result = { subject?: string; from?: string | null; receivedAt?: string | null; status: string };

export function attentionReason(status: string): AttentionReason | null {
  if (status === "skipped_no_match") return "no_match";
  if (status === "skipped_no_pdf") return "no_pdf";
  if (status === "error" || status.startsWith("error") || status.startsWith("parse_error") || status.startsWith("attachment_error")) return "unreadable";
  return null;
}

export function attentionFrom(results: Result[], now = new Date()): Attention {
  const items: AttentionItem[] = [];
  for (const r of results) {
    const reason = attentionReason(r.status);
    if (!reason) continue;
    items.push({
      subject: r.subject ?? "(no subject)", from: r.from ?? null, receivedAt: r.receivedAt ?? null, reason,
      ...(reason === "unreadable" && r.status !== "error" ? { detail: r.status.replace(/^parse_error: |^error: /, "").slice(0, 200) } : {}),
    });
  }
  items.sort((a, b) => (b.receivedAt ?? "").localeCompare(a.receivedAt ?? ""));
  return { at: now.toISOString(), items: items.slice(0, 100) };
}

export async function saveAttention(db: PrismaClient, attention: Attention) {
  const value = JSON.stringify(attention);
  await db.setting.upsert({ where: { key: ATTENTION_KEY }, update: { value }, create: { key: ATTENTION_KEY, value } });
}

export async function readAttention(db: PrismaClient): Promise<Attention | null> {
  const row = await db.setting.findUnique({ where: { key: ATTENTION_KEY } });
  try { return row ? (JSON.parse(row.value) as Attention) : null; } catch { return null; }
}
