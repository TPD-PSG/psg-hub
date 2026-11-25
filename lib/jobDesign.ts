// A build's design side: who's on it (contacts) and the designer's drawings and model box photos.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobViewer } from "@/lib/jobData";
import { denyOutOfScope } from "@/lib/companyScope";

import { CONTACT_ROLES } from "@/lib/jobDesignShared";
export { CONTACT_ROLES, contactRoleLabel } from "@/lib/jobDesignShared";

export const FILE_KINDS = { design: ["application/pdf", "image/png", "image/jpeg", "image/webp"], modelbox: ["image/png", "image/jpeg", "image/webp"] } as const;
export const FILE_MAX = 25 * 1024 * 1024;
export const FILE_SELECT = { id: true, kind: true, name: true, mime: true, size: true, caption: true, createdAt: true, uploadedById: true, uploadedBy: { select: { name: true } } } as const;
export const fileUrl = (id: number) => `/api/job-files/${id}`;

/** PSG staff who can see this job (companies they can see). */
export async function jobAccess(rawId: string) {
  const out = await denyOutOfScope("job", rawId);
  if (out) return { error: out };
  const v = await requireJobViewer();
  if ("error" in v) return { error: v.error };
  const id = parseInt(rawId);
  if (!(await prisma.job.count({ where: { id } }))) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { v, id };
}

export function contactFields(body: Record<string, unknown>, creating: boolean): { data: Record<string, unknown> } | { error: string } {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const data: Record<string, unknown> = {};
  if (creating || has("name")) { const n = text(body.name, 120); if (!n) return { error: "Who is it?" }; data.name = n; }
  if (creating || has("role")) data.role = CONTACT_ROLES.some(r => r.key === body.role) ? body.role : "other";
  for (const [k, max] of [["company", 120], ["phone", 40], ["notes", 500]] as const) if (has(k)) data[k] = text(body[k], max);
  if (has("email")) {
    const e = text(body.email, 200);
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: "That email doesn't look right" };
    data.email = e;
  }
  return { data };
}
