// The group compliance register (26 Nov 2026): who can see it (staff: admins and members, within the
// companies they can see) and who can change an item (admins, and that item's owner).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { companyLimit } from "@/lib/companyScope";
import { saveFile } from "@/lib/storage";
import { complianceStatus } from "@/lib/complianceCore";

export type CViewer = { userId: number; role: string; admin: boolean; limit: number[] | null };

export async function complianceViewer(): Promise<CViewer | { error: NextResponse }> {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = u.role ?? "member";
  if (role !== "admin" && role !== "member") return { error: NextResponse.json({ error: "The compliance register is for staff" }, { status: 403 }) };
  const userId = Number(u.id);
  return { userId, role, admin: role === "admin", limit: role === "admin" ? null : await companyLimit(userId) };
}

/** Items a limited person can see: their companies' items and the group-wide ones. */
export const visibleItems = (v: CViewer) => (v.limit ? { OR: [{ entityId: null }, { entityId: { in: v.limit } }] } : {});
export const canManage = (v: CViewer, item: { ownerId: number | null }) => v.admin || item.ownerId === v.userId;

export const ITEM_INCLUDE = {
  entity: { select: { id: true, name: true, shortName: true } },
  owner: { select: { id: true, name: true } },
  documents: { orderBy: { createdAt: "desc" as const }, select: { id: true, name: true, mime: true, validFrom: true, expiresAt: true, version: true, createdAt: true, uploadedBy: { select: { name: true } } } },
};

export async function register(v: CViewer) {
  const now = new Date();
  const items = await prisma.complianceItem.findMany({ where: visibleItems(v), include: ITEM_INCLUDE, orderBy: [{ archived: "asc" }, { category: "asc" }, { name: "asc" }] });
  const entities = await prisma.entity.findMany({ where: { archived: false, ...(v.limit ? { id: { in: v.limit } } : {}) }, select: { id: true, name: true, shortName: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const staff = await prisma.user.findMany({ where: { role: { in: ["admin", "member"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return {
    admin: v.admin, me: v.userId, entities, staff,
    items: items.map(i => ({ ...i, status: complianceStatus(i, now), canManage: canManage(v, i) })),
  };
}

const dateOrNull = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);
const text = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) || null : null);

/** Fields from a form; `full` = creating (name and category needed). */
export async function itemFields(b: Record<string, unknown>, full: boolean, v: CViewer): Promise<{ data: Record<string, unknown> } | { error: string }> {
  const has = (k: string) => full || k in b;
  const data: Record<string, unknown> = {};
  if (has("name")) { const n = text(b.name, 120); if (!n) return { error: "Name it" }; data.name = n; }
  if (has("category")) { const { isCategory } = await import("@/lib/complianceCore"); if (!isCategory(b.category)) return { error: "Pick a kind" }; data.category = b.category; }
  if (has("entityId")) {
    const e = b.entityId === "" || b.entityId == null ? null : Number(b.entityId);
    if (e !== null && !(await prisma.entity.count({ where: { id: e } }))) return { error: "Unknown company" };
    if (v.limit && (e === null ? !v.admin : !v.limit.includes(e))) return { error: "That company isn't one of yours" };
    data.entityId = e;
  }
  for (const k of ["issuer", "reference", "cover", "version", "notes"] as const) if (has(k)) data[k] = text(b[k], k === "notes" ? 2000 : 160);
  for (const k of ["validFrom", "expiresAt", "reviewAt"] as const) if (has(k)) data[k] = dateOrNull(b[k]);
  if (has("ownerId")) {
    const o = b.ownerId === "" || b.ownerId == null ? null : Number(b.ownerId);
    if (o !== null && !(await prisma.user.count({ where: { id: o, role: { in: ["admin", "member"] } } }))) return { error: "The owner must be a member of staff" };
    data.ownerId = o;
  }
  if ("archived" in b) data.archived = !!b.archived;
  return { data };
}

/** Save an uploaded document for an item, with the dates it covers. */
export async function addDocument(itemId: number, file: File, meta: { validFrom: Date | null; expiresAt: Date | null; version: string | null }, by: number) {
  const ok = ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"];
  if (!ok.includes(file.type)) return { error: "Upload a PDF, Word document or picture" };
  if (file.size > 20 * 1024 * 1024) return { error: "That file is too big (20 MB at most)" };
  const buf = Buffer.from(await file.arrayBuffer());
  const saved = await saveFile("compliance", file.name, buf, file.type);
  await prisma.complianceDocument.create({ data: { itemId, name: file.name.slice(0, 160), mime: file.type, fileKey: saved.key, data: saved.base64 ?? "", ...meta, uploadedById: by } });
  return { ok: true };
}
export { dateOrNull, text };
