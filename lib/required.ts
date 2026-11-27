// Required fields on a form (27 Nov 2026): a missing or blank field gets a plain 400 saying what's
// needed, instead of a server error or a half-empty record.
import { NextResponse } from "next/server";

const filled = (v: unknown) => (typeof v === "string" ? v.trim() !== "" : typeof v === "number" ? Number.isFinite(v) : v != null && v !== false);

/** The first field that's missing, as a 400 with its message; null when everything's there. */
export function missing(body: unknown, fields: Record<string, string>): NextResponse | null {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  for (const [key, message] of Object.entries(fields)) if (!filled(b[key])) return NextResponse.json({ error: message, field: key }, { status: 400 });
  return null;
}

/** For edits, which only send what changed: a required field that's sent blank is refused. */
export function blanked(body: unknown, fields: Record<string, string>): NextResponse | null {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  for (const [key, message] of Object.entries(fields)) if (key in b && !filled(b[key])) return NextResponse.json({ error: message, field: key }, { status: 400 });
  return null;
}
