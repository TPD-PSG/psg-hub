// Client fields from a request body. Only keys the body sends are changed, so ticking "target
// account" can't wipe the billing details.
export function clientData(body: Record<string, unknown>) {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const d: Record<string, unknown> = {};
  if (has("name") && text(body.name)) d.name = text(body.name);
  if (has("type") && text(body.type)) d.type = text(body.type);
  for (const k of ["website", "address", "notes", "billingName", "billingAddress", "billingEmail", "targetSource"]) if (has(k)) d[k] = text(body[k]);
  if (has("targetAccount")) d.targetAccount = body.targetAccount === true || body.targetAccount === "true";
  if (has("targetOwnerId")) { const n = Number(body.targetOwnerId); d.targetOwnerId = body.targetOwnerId && Number.isInteger(n) ? n : null; }
  return d;
}

/** A sales invoice belongs to a client when its party matches the client's name or billing name. */
export const sameParty = (party: string, names: (string | null | undefined)[]) =>
  names.some(n => n && n.trim().toLowerCase() === party.trim().toLowerCase());
