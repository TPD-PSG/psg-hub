// Shared by the opportunities API routes: what a deal returns, and how a request body becomes
// the fields to save (only the fields the request actually sends are changed).
import type { Prisma } from "@prisma/client";
import { STAGE_KEYS } from "@/lib/bdPipeline";

export const OPPORTUNITY_INCLUDE = {
  client: true,
  tasks: { orderBy: { dueDate: "asc" } },
  entity: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  production: { select: { id: true, name: true } },
  job: { select: { id: true, number: true } },
  activities: { orderBy: { at: "desc" }, take: 1, select: { at: true } },
} satisfies Prisma.OpportunityInclude;

type WithLatest = { activities?: { at: Date }[] } & Record<string, unknown>;
/** Swap the one-row activities list for `lastActivityAt`. */
export function shapeOpportunity<T extends WithLatest>(o: T) {
  const { activities, ...rest } = o;
  return { ...rest, lastActivityAt: activities?.[0]?.at ?? null };
}

const num = (v: unknown) => (v === "" || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const int = (v: unknown) => { const n = num(v); return n == null ? null : Math.round(n); };
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const date = (v: unknown) => (typeof v === "string" && v ? new Date(v) : null);

/** Fields to write from a request body. Keys missing from the body are left alone. */
export function opportunityData(body: Record<string, unknown>) {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const d: Record<string, unknown> = {};
  if (has("title") && text(body.title)) d.title = text(body.title);
  if (has("type") && text(body.type)) d.type = text(body.type);
  if (has("stage") && typeof body.stage === "string" && STAGE_KEYS.includes(body.stage)) d.stage = body.stage;
  if (has("value")) d.value = num(body.value);
  if (has("clientId")) d.clientId = int(body.clientId);
  if (has("description")) d.description = text(body.description);
  if (has("closeDate")) d.closeDate = date(body.closeDate);
  if (has("lostReason")) d.lostReason = text(body.lostReason);
  if (has("notes")) d.notes = text(body.notes);
  if (has("entityId")) d.entityId = int(body.entityId);
  if (has("ownerUserId")) d.ownerUserId = int(body.ownerUserId);
  if (has("probability")) { const p = int(body.probability); d.probability = p == null ? null : Math.max(0, Math.min(100, p)); }
  if (has("followUpDate")) d.followUpDate = date(body.followUpDate);
  if (has("leadSource")) d.leadSource = text(body.leadSource);
  if (has("competitor")) d.competitor = text(body.competitor);
  return d;
}
