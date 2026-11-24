// Venue sync with x-over (the theatre company-management platform). x-over calls these endpoints with a
// shared bearer token (env XOVER_SYNC_TOKEN); PSG Hub never calls x-over.
//
// x-over pulls the venue list (with contacts and tech specs), and sends back venues its customers add and
// changes they make, after x-over's own staff have approved them.
import { makeGuard, text, InputError, VENUE_TYPES } from "@/lib/night-run-sync";

export { bad, readJson, InputError } from "@/lib/night-run-sync";
export const guard = makeGuard("XOVER_SYNC_TOKEN");

/** The venue fields x-over may set. */
export const XOVER_FIELDS = ["name", "address", "city", "postcode", "phone", "email", "website", "capacity", "techNotes"] as const;
type Field = (typeof XOVER_FIELDS)[number];
export type VenueInput = Partial<Record<Exclude<Field, "capacity" | "name">, string | null> & { name: string; capacity: number | null }>;

function capacity(body: Record<string, unknown>): number | null {
  const v = body.capacity;
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 200000) throw new InputError("capacity must be a whole number (0–200000)");
  return v;
}

const LIMITS: Record<Exclude<Field, "capacity">, number> = {
  name: 200, address: 500, city: 100, postcode: 20, phone: 50, email: 200, website: 500, techNotes: 8000,
};

/**
 * The fields present in the body (a change sends only what changed). Unknown keys are refused, so a
 * mistyped field name fails loudly instead of being dropped.
 */
export function parseVenueInput(body: Record<string, unknown>, opts: { requireName: boolean }): VenueInput {
  const unknown = Object.keys(body).filter((k) => !(XOVER_FIELDS as readonly string[]).includes(k) && k !== "type");
  if (unknown.length) throw new InputError(`Unknown field: ${unknown.join(", ")}`);
  const out: VenueInput = {};
  for (const k of XOVER_FIELDS) {
    if (!(k in body)) continue;
    if (k === "capacity") out.capacity = capacity(body);
    else if (k === "name") {
      const name = text(body, k, LIMITS.name);
      if (!name) throw new InputError("name can't be empty");
      out.name = name;
    } else out[k] = text(body, k, LIMITS[k]);
  }
  if (opts.requireName && !out.name) throw new InputError("name is required");
  return out;
}

export function venueType(body: Record<string, unknown>) {
  const raw = text(body, "type", 50)?.toLowerCase() ?? "";
  return VENUE_TYPES.includes(raw) ? raw : "theatre";
}

/** Stored tech specs as { section: { field: value } }, keeping only filled-in text values. */
export function techSpecsJson(raw: string | null): Record<string, Record<string, string>> | null {
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const out: Record<string, Record<string, string>> = {};
  for (const [section, fields] of Object.entries(parsed as Record<string, unknown>)) {
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) continue;
    const kept = Object.entries(fields as Record<string, unknown>).filter(([, v]) => (typeof v === "string" && v.trim()) || typeof v === "number");
    if (kept.length) out[section] = Object.fromEntries(kept.map(([k, v]) => [k, String(v).trim()]));
  }
  return Object.keys(out).length ? out : null;
}
