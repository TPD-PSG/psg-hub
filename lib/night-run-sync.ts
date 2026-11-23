// Venue sync with Night Run (PSG's haulage app). Contract: night-run/docs/HUB_SYNC.md.
// Night Run calls these endpoints with a shared token; PSG Hub never calls Night Run.
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------- auth ----------

const sha = (s: string) => crypto.createHash("sha256").update(s).digest();

// Constant-time token check. Hashing first makes both sides the same length, so
// timingSafeEqual never throws and the comparison time doesn't depend on the guess.
export function tokenOk(req: NextRequest): boolean {
  const expected = process.env.NIGHT_RUN_SYNC_TOKEN ?? "";
  if (expected.length < 32) return false; // not configured (or too short to be safe): refuse everyone
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  const given = m ? m[1].trim() : "";
  return crypto.timingSafeEqual(sha(given), sha(expected)) && given.length > 0;
}

// ---------- rate limit ----------

// Per client IP, sliding window. A sync is one GET plus one PUT/POST per changed venue,
// so this leaves room for a big first sync while stopping a runaway loop or token guessing.
const WINDOW_MS = 60 * 1000;
const MAX_HITS = 600;
const MAX_BAD_AUTH = 20;
const hits = new Map<string, number[]>();
const badAuth = new Map<string, number[]>();

function bump(map: Map<string, number[]>, ip: string, max: number): boolean {
  const now = Date.now();
  const list = (map.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
  list.push(now);
  map.set(ip, list);
  if (map.size > 1000) for (const [k, v] of map) if (!v.some(t => now - t < WINDOW_MS)) map.delete(k);
  return list.length > max;
}

const clientIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";

// Runs before every handler: rate limit, then the token. Returns a response to send, or null to carry on.
export function guard(req: NextRequest): NextResponse | null {
  const ip = clientIp(req);
  const recentBad = (badAuth.get(ip) ?? []).filter(t => Date.now() - t < WINDOW_MS).length;
  if (recentBad >= MAX_BAD_AUTH || bump(hits, ip, MAX_HITS)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  if (!tokenOk(req)) {
    bump(badAuth, ip, MAX_BAD_AUTH);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function readJson(req: NextRequest): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false }> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false };
    return { ok: true, body };
  } catch {
    return { ok: false };
  }
}

// ---------- validation ----------

export class InputError extends Error {}

// Optional plain-text field: missing/null/"" → null; anything but a string is rejected.
function text(body: Record<string, unknown>, key: string, max: number): string | null {
  const v = body[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new InputError(`${key} must be a string`);
  const t = v.trim();
  if (t.length > max) throw new InputError(`${key} is longer than ${max} characters`);
  return t || null;
}

function mm(body: Record<string, unknown>, key: string): number | null {
  const v = body[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100000) {
    throw new InputError(`${key} must be a whole number of millimetres (0–100000)`);
  }
  return v;
}

function bool(body: Record<string, unknown>, key: string): boolean | null {
  const v = body[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== "boolean") throw new InputError(`${key} must be true, false or null`);
  return v;
}

export const DROP_OFF_FIELDS = [
  "loadingAddress", "loadingPostcode", "what3words", "accessTimes", "maxVehicle", "heightLimitMm",
  "widthLimitMm", "dockNotes", "unloadingNotes", "forkliftOnSite", "parkingNotes", "emissionZone",
] as const;

export type DropOff = {
  loadingAddress: string | null; loadingPostcode: string | null; what3words: string | null;
  accessTimes: string | null; maxVehicle: string | null; heightLimitMm: number | null;
  widthLimitMm: number | null; dockNotes: string | null; unloadingNotes: string | null;
  forkliftOnSite: boolean | null; parkingNotes: string | null; emissionZone: string | null;
};

// All fields, every time: a missing field means null (the PUT replaces PSG Hub's copy).
export function parseDropOff(body: Record<string, unknown>): DropOff {
  return {
    loadingAddress: text(body, "loadingAddress", 500),
    loadingPostcode: text(body, "loadingPostcode", 20),
    what3words: text(body, "what3words", 100),
    accessTimes: text(body, "accessTimes", 1000),
    maxVehicle: text(body, "maxVehicle", 200),
    heightLimitMm: mm(body, "heightLimitMm"),
    widthLimitMm: mm(body, "widthLimitMm"),
    dockNotes: text(body, "dockNotes", 4000),
    unloadingNotes: text(body, "unloadingNotes", 4000),
    forkliftOnSite: bool(body, "forkliftOnSite"),
    parkingNotes: text(body, "parkingNotes", 4000),
    emissionZone: text(body, "emissionZone", 200),
  };
}

export const VENUE_TYPES = ["theatre", "arena", "outdoor", "club", "conference", "hotel", "other"];

export function parseNewVenue(body: Record<string, unknown>) {
  const name = text(body, "name", 200);
  if (!name) throw new InputError("name is required");
  const rawType = text(body, "type", 50)?.toLowerCase() ?? "";
  let dropOff: DropOff | null = null;
  if (body.dropOff !== undefined && body.dropOff !== null) {
    if (typeof body.dropOff !== "object" || Array.isArray(body.dropOff)) throw new InputError("dropOff must be an object or null");
    dropOff = parseDropOff(body.dropOff as Record<string, unknown>);
  }
  return {
    venue: {
      name,
      type: VENUE_TYPES.includes(rawType) ? rawType : "other",
      address: text(body, "address", 500),
      city: text(body, "city", 100),
      postcode: text(body, "postcode", 20),
      phone: text(body, "phone", 50),
      email: text(body, "email", 200),
      website: text(body, "website", 500),
    },
    dropOff,
  };
}

// ---------- output ----------

type DropOffRow = DropOff & { id: number; venueId: number; createdAt: Date; updatedAt: Date };

export function dropOffJson(d: DropOffRow | null): DropOff | null {
  if (!d) return null;
  return Object.fromEntries(DROP_OFF_FIELDS.map(k => [k, d[k]])) as DropOff;
}

// Called whenever a venue's contacts change, so Night Run's `updatedSince` pull picks the change up.
export async function touchVenue(venueId: number) {
  await prisma.venue.updateMany({ where: { id: venueId }, data: { updatedAt: new Date() } });
}
