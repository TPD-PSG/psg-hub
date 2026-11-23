import { NextResponse } from "next/server";

// Money typed by people: "1,200", "£1,200.50", " 300 " → number. Blank or junk → null.
export function money(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[£$€,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// A date from a form field. Missing or invalid → undefined (Prisma then leaves the column unchanged on update).
export function toDate(v: unknown): Date | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// 400 response naming the required date fields that are missing or invalid, or null if all fine
export function missingDates(body: Record<string, unknown>, keys: string[]): NextResponse | null {
  const bad = keys.filter(k => !toDate(body[k]));
  return bad.length ? NextResponse.json({ error: `Missing or invalid date: ${bad.join(", ")}` }, { status: 400 }) : null;
}

// JSON.parse that never throws
export function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
