// The roadmap is one shared list: the main Hub and every company space see the same items.
// Items raised from a space remember it (entityId) so both sides can see where an idea came from.
export const ROADMAP_STATUSES = ["idea", "planned", "in_progress", "done", "wont_do"];
export const ROADMAP_CATEGORIES = ["general", "feature", "improvement", "bug", "infrastructure"];
export const ROADMAP_INCLUDE = {
  createdByUser: { select: { id: true, name: true, avatarUrl: true } },
  entity: { select: { id: true, name: true, shortName: true } },
} as const;

/** The fields a create or edit may set, cleaned. */
export function roadmapFields(body: Record<string, unknown>, creating: boolean) {
  const d: Record<string, unknown> = {};
  if (body.title !== undefined || creating) {
    const t = String(body.title ?? "").trim().slice(0, 200);
    if (!t) return { error: "Give it a title" };
    d.title = t;
  }
  if (body.body !== undefined) d.body = String(body.body ?? "").trim().slice(0, 4000) || null;
  if (body.category !== undefined) {
    if (!ROADMAP_CATEGORIES.includes(String(body.category))) return { error: "Unknown category" };
    d.category = body.category;
  }
  if (body.status !== undefined) {
    if (!ROADMAP_STATUSES.includes(String(body.status))) return { error: "Unknown status" };
    d.status = body.status;
  }
  return { data: d };
}
