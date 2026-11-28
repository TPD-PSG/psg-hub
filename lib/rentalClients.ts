// PSG Rentals & Crew for client logins (stage 5, 27 Nov 2026): a client company's hires, the rate
// card, accepting a quote and asking for one. Clients never see internal notes, sub-hires, what
// kit costs us, or a quote the team hasn't sent them yet.
import { prisma } from "@/lib/prisma";
import { spaceLogoUrl } from "@/lib/entities";
import { hireTotals } from "@/lib/rentals";
import { notify } from "@/lib/clientPortal";
import type { SpaceTheme } from "@/lib/spaces";
import { forRateCard } from "@/lib/crewRates";

const ENTITY = { id: true, name: true, shortName: true, slug: true, color: true, logoMime: true, updatedAt: true, hasSpace: true, archived: true, address: true, phone: true, spaceKind: true } as const;

/** The rentals spaces clients can see the rate card of and ask for quotes from. */
export async function rentalCompanies() {
  return prisma.entity.findMany({ where: { spaceKind: "rentals", hasSpace: true, archived: false, slug: { not: null } }, select: ENTITY, orderBy: { sortOrder: "asc" } });
}
export const brandOf = (e: { id: number; name: string; shortName: string | null; slug: string | null; color: string | null; logoMime: string | null; updatedAt: Date } | null | undefined): SpaceTheme | null =>
  e && e.slug ? { id: e.id, name: e.name, shortName: e.shortName, slug: e.slug, color: e.color, logoUrl: spaceLogoUrl(e), kind: "rentals" } : null;

/** A hire is the client's to see once it's confirmed, or once a quote has been sent or they asked for it. */
export const clientCanSee = { OR: [{ status: { in: ["confirmed", "out", "returned"] } }, { status: "quote", OR: [{ quoteSentAt: { not: null } }, { requestedAt: { not: null } }] }] };

export async function clientHires(clientId: number) {
  const hires = await prisma.rentalHire.findMany({
    where: { clientId, ...clientCanSee },
    select: {
      id: true, number: true, title: true, status: true, clientName: true, clientEmail: true, outDate: true, returnDate: true,
      chargeDays: true, discountPct: true, vatRate: true, paymentTerms: true, customerPo: true, delivery: true, deliveryTo: true,
      validUntil: true, terms: true, quoteSentAt: true, createdAt: true, requestedAt: true, acceptedAt: true, acceptedBy: true,
      createdBy: { select: { name: true } }, production: { select: { name: true } },
      entity: { select: { name: true, hasSpace: true, slug: true, color: true, logoMime: true, updatedAt: true, address: true, phone: true } },
      lines: { orderBy: { sortOrder: "asc" }, select: { quantity: true, dayRate: true, weekRate: true, unitPrice: true, discountPct: true, note: true, product: { select: { name: true, category: true } } } },
      charges: { orderBy: { sortOrder: "asc" }, select: { description: true, quantity: true, unitPrice: true } },
    },
    orderBy: { outDate: "desc" },
  });
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  return hires.map(h => {
    const t = hireTotals(h);
    // A requested quote isn't priced until the team sends it
    const priced = h.status !== "quote" || !!h.quoteSentAt;
    return {
      ...h, totals: priced ? { days: t.days, net: t.net, vat: t.vat, gross: t.gross } : null, priced,
      canAccept: h.status === "quote" && !!h.quoteSentAt && !h.acceptedAt && (!h.validUntil || h.validUntil >= today),
    };
  });
}

/** PSG staff to tell about a client's request or acceptance: the space's people, else admins. */
export async function rentalStaff(entityId: number) {
  const home = await prisma.user.findMany({ where: { homeEntityId: entityId, role: { in: ["admin", "member"] } }, select: { id: true } });
  if (home.length) return home.map(u => u.id);
  return (await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } })).map(u => u.id);
}
export async function tellRentalStaff(hire: { id: number; entityId: number; createdById: number | null }, title: string, body: string | null) {
  const e = await prisma.entity.findUnique({ where: { id: hire.entityId }, select: { slug: true } });
  await notify([hire.createdById, ...(await rentalStaff(hire.entityId))], { title, body, link: e?.slug ? `/spaces/${e.slug}/hires?hire=${hire.id}` : null });
}

/** The rate card: kit with a day or week rate, by category, and crew roles with a client charge (no stock levels, no costs, no crew pay). */
export async function rateCard(entityId: number) {
  const [entity, products, crew] = await Promise.all([
    prisma.entity.findUnique({ where: { id: entityId }, select: ENTITY }),
    prisma.rentalProduct.findMany({
      where: { entityId, archived: false, OR: [{ dayRate: { not: null } }, { weekRate: { not: null } }], units: { some: { status: "available" } } },
      select: { id: true, name: true, category: true, manufacturer: true, model: true, dayRate: true, weekRate: true, weightKg: true, powerW: true, isCase: true },
      orderBy: { name: "asc" },
    }),
    prisma.crewRate.findMany({ where: { entityId, onRateCard: true, archived: false, chargeRate: { not: null } }, orderBy: [{ sortOrder: "asc" }, { role: "asc" }] }),
  ]);
  if (!entity) return null;
  return { company: { id: entity.id, name: entity.name, address: entity.address, phone: entity.phone, brand: brandOf(entity) }, products: products.filter(p => !p.isCase), crew: forRateCard(crew) };
}
