import { prisma } from "@/lib/prisma";


/** Stock item fields from a body; only keys sent are changed. */
export async function stockFields(body: Record<string, unknown>, creating: boolean): Promise<{ data: Record<string, unknown> } | { error: string }> {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const num = (v: unknown) => (v === "" || v == null ? null : Number(v));
  const data: Record<string, unknown> = {};
  if (creating || has("name")) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { error: "Name the item" };
    data.name = name.slice(0, 120);
  }
  if (has("unit")) data.unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim().slice(0, 20) : "each";
  for (const k of ["reorderLevel", "unitCost"] as const) if (has(k)) {
    const n = num(body[k]);
    if (n !== null && (!isFinite(n) || n < 0)) return { error: k === "unitCost" ? "Cost can't be negative" : "Reorder level can't be negative" };
    data[k] = n;
  }
  if (creating && has("quantity")) {
    const q = Number(body.quantity || 0);
    if (!isFinite(q) || q < 0) return { error: "Quantity can't be negative" };
    data.quantity = q;
  }
  if (has("location")) data.location = typeof body.location === "string" && body.location.trim() ? body.location.trim().slice(0, 80) : null;
  if (has("section")) data.section = typeof body.section === "string" && body.section.trim() ? body.section.trim().replace(/\s+/g, " ").slice(0, 40) : null;
  if (has("archived")) data.archived = !!body.archived;
  if (has("supplierId")) {
    const id = num(body.supplierId);
    if (id !== null && !(await prisma.supplier.count({ where: { id } }))) return { error: "Unknown supplier" };
    data.supplierId = id;
  }
  return { data };
}
