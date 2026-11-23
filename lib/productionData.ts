// Loads one production the way the signed-in user is allowed to see it.
// Used by GET /api/productions/[id] and by the production page (server-rendered), so both apply
// exactly the same access rules and hidden-tab stripping.
import { prisma } from "@/lib/prisma";
import { requireProductionAccess } from "@/lib/access";

export async function loadProductionForViewer(id: string) {
  const access = await requireProductionAccess(id);
  if ("error" in access) {
    const status = access.error.status as 400 | 401 | 403;
    return { status, error: status === 403 ? "You don't have access to this production" : status === 401 ? "Unauthorized" : "Invalid production" };
  }
  const production = await prisma.production.findUnique({
    where: { id: Number(id) },
    include: {
      events: { orderBy: { startAt: "asc" } },
      budgetLines: {
        orderBy: { department: "asc" },
        include: {
          expenses: {
            orderBy: { createdAt: "asc" },
            include: {
              documents: {
                select: { id: true, type: true, name: true, mime: true, invoiceDate: true, invoiceAmount: true, invoiceNumber: true, issuedForPayment: true, createdAt: true },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
      crew: {
        orderBy: { createdAt: "asc" },
        include: { crew: true },
      },
      hotelBookings: {
        orderBy: { checkIn: "asc" },
        include: { hotel: true, crew: true },
      },
      haulageMovements: {
        orderBy: { departureAt: "asc" },
      },
      productionDocuments: {
        select: { id: true, name: true, mime: true, folder: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      productionLinks: {
        orderBy: { createdAt: "asc" },
      },
      tourStops: {
        orderBy: { stopNumber: "asc" },
        include: { venue: { select: { id: true, name: true, city: true } } },
      },
      hsDocuments: {
        select: { id: true, name: true, mime: true, folder: true, tourStopId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      toolboxSignatures: {
        select: { id: true, tourStopId: true, venueName: true, signeeName: true, signeeDate: true, employer: true, position: true, agreedBriefing: true, agreedSafety: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      team: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      venueRef: { select: { id: true, name: true, city: true, capacity: true } },
      bdClient: { select: { id: true, name: true, type: true, address: true, website: true, billingName: true, billingAddress: true, billingEmail: true } },
    },
  });
  if (!production) return { status: 404 as const, error: "Not found" };
  // Don't send tabs the user can't see (e.g. budget and crew for freelancers/clients)
  const h = access.hidden;
  return { status: 200 as const, data: {
    ...production,
    budgetLines: h.has("budget") ? [] : production.budgetLines,
    crew: h.has("crew") ? [] : production.crew,
    productionLinks: h.has("links") ? [] : production.productionLinks,
    hotelBookings: h.has("accommodation") ? [] : production.hotelBookings,
    haulageMovements: h.has("haulage") ? [] : production.haulageMovements,
    productionDocuments: h.has("documents") ? [] : production.productionDocuments,
    hsDocuments: h.has("hs") ? [] : production.hsDocuments,
  } };
}

export type ProductionForViewer = Extract<Awaited<ReturnType<typeof loadProductionForViewer>>, { status: 200 }>["data"];
