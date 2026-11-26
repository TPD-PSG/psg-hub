// Accident & incident reports (26 Nov 2026): who may see and manage them, creating them, and
// what goes back to the browser. Injury details are personal data, so the rule is:
//   H&S leads (admins + Setting "hs_lead_ids") see every report and sign them off;
//   a production's team staff (members on its team) see and follow up that show's reports;
//   anyone else sees only what they reported themselves.
import { prisma } from "@/lib/prisma";
import { companyLimit } from "@/lib/companyScope";
import { notify } from "@/lib/clientPortal";
import { KIND_LABEL, incidentRef, isKind, isRiddor, riddorDue, INJURED_ROLES, TREATMENTS } from "@/lib/incidentsCore";

export const HS_LEADS_SETTING = "hs_lead_ids";

export async function hsLeadIds(): Promise<number[]> {
  const s = await prisma.setting.findUnique({ where: { key: HS_LEADS_SETTING } });
  try { const v = JSON.parse(s?.value ?? "[]"); return Array.isArray(v) ? v.map(Number).filter(Number.isInteger) : []; } catch { return []; }
}

/** Everyone who leads on H&S: the named leads plus the admins. */
export async function allLeads(): Promise<number[]> {
  const [named, admins] = await Promise.all([hsLeadIds(), prisma.user.findMany({ where: { role: "admin" }, select: { id: true } })]);
  return [...new Set([...named, ...admins.map(a => a.id)])];
}

export async function isHsLead(userId: number, role: string) {
  return role === "admin" || (role === "member" && (await hsLeadIds()).includes(userId));
}

/** The productions whose reports this person manages, or "all" for an H&S lead. */
export async function managedProductions(userId: number, role: string): Promise<"all" | number[]> {
  if (await isHsLead(userId, role)) return "all";
  if (role !== "member") return [];
  const teams = await prisma.productionTeam.findMany({ where: { userId }, select: { productionId: true } });
  return teams.map(t => t.productionId);
}

/** How this person stands on one production's reports. */
export async function incidentAccess(userId: number, role: string, productionId: number): Promise<{ lead: boolean; manage: boolean }> {
  const lead = await isHsLead(userId, role);
  if (lead) return { lead, manage: true };
  if (role !== "member") return { lead, manage: false };
  const onTeam = await prisma.productionTeam.findUnique({ where: { productionId_userId: { productionId, userId } }, select: { id: true } });
  return { lead, manage: !!onTeam };
}

/** The where-clause for the central page: what this person may see across all shows. */
export async function visibleWhere(userId: number, role: string) {
  const managed = await managedProductions(userId, role);
  const limit = role === "admin" ? null : await companyLimit(userId);
  const scope = limit ? { production: { entityId: { in: limit } } } : {};
  if (managed === "all") return scope;
  return { ...scope, OR: [{ productionId: { in: managed } }, { reportedById: userId }] };
}

export const INCIDENT_INCLUDE = {
  production: { select: { id: true, name: true } },
  reportedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
  actions: { orderBy: { createdAt: "asc" as const }, include: { owner: { select: { id: true, name: true } } } },
};

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const isDate = (v: unknown) => typeof v === "string" && !Number.isNaN(new Date(v).getTime());

/** Check and tidy what a report form sent. Returns the fields or an error to show. */
export function readReport(body: Record<string, unknown>): { data: ReportFields } | { error: string } {
  if (!isKind(body.kind)) return { error: "Pick what kind of incident it was" };
  if (!isDate(body.occurredAt)) return { error: "When did it happen?" };
  const occurredAt = new Date(body.occurredAt as string);
  if (occurredAt.getTime() > Date.now() + 3600e3) return { error: "That date is in the future" };
  const description = text(body.description, 5000);
  if (!description) return { error: "Say what happened" };
  const reporterName = text(body.reporterName, 120);
  if (!reporterName) return { error: "Add your name" };
  const treatment = typeof body.treatment === "string" && TREATMENTS.some(([t]) => t === body.treatment) ? body.treatment : null;
  const injuredRole = typeof body.injuredRole === "string" && INJURED_ROLES.includes(body.injuredRole) ? body.injuredRole : text(body.injuredRole, 80);
  const hurt = body.kind === "accident" || body.kind === "ill_health";
  return {
    data: {
      kind: body.kind, occurredAt, description, reporterName,
      location: text(body.location, 200), venueName: text(body.venueName, 200),
      immediateAction: text(body.immediateAction, 3000), witnesses: text(body.witnesses, 1000),
      reporterContact: text(body.reporterContact, 200),
      injuredName: hurt ? text(body.injuredName, 120) : null,
      injuredRole: hurt ? injuredRole : null,
      injuredEmployer: hurt ? text(body.injuredEmployer, 200) : null,
      injuryDetails: hurt ? text(body.injuryDetails, 2000) : null,
      bodyPart: hurt ? text(body.bodyPart, 120) : null,
      treatment: hurt ? treatment : null,
      offWork: hurt && !!body.offWork,
    },
  };
}
export type ReportFields = {
  kind: string; occurredAt: Date; description: string; reporterName: string; location: string | null; venueName: string | null;
  immediateAction: string | null; witnesses: string | null; reporterContact: string | null; injuredName: string | null; injuredRole: string | null;
  injuredEmployer: string | null; injuryDetails: string | null; bodyPart: string | null; treatment: string | null; offWork: boolean;
};

/** File a report: number it for the year, then tell the H&S leads and the show's team staff. */
export async function createIncident(productionId: number, data: ReportFields, by: { userId: number | null; viaQr: boolean }) {
  const year = new Date().getFullYear();
  let incident = null;
  for (let attempt = 0; attempt < 5 && !incident; attempt++) {
    const last = await prisma.incident.findFirst({ where: { year }, orderBy: { number: "desc" }, select: { number: true } });
    try {
      incident = await prisma.incident.create({ data: { ...data, productionId, year, number: (last?.number ?? 0) + 1, reportedById: by.userId, viaQr: by.viaQr } });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // someone else took that number: try the next
    }
  }
  if (!incident) throw new Error("Couldn't number the report");
  const [leads, team, prod] = await Promise.all([
    allLeads(),
    prisma.productionTeam.findMany({ where: { productionId, user: { role: "member" } }, select: { userId: true } }),
    prisma.production.findUnique({ where: { id: productionId }, select: { name: true } }),
  ]);
  await notify([...leads, ...team.map(t => t.userId)].filter(id => id !== by.userId), {
    title: `${KIND_LABEL[data.kind]} reported on ${prod?.name ?? "a production"} (${incidentRef(incident)})`,
    body: data.description.slice(0, 200),
    link: `/productions/${productionId}?section=hs&incident=${incident.id}`,
  });
  return incident;
}

/** Fields a manager may change while following a report up (the sign-off itself is separate). */
export function readFollowUp(body: Record<string, unknown>, occurredAt: Date) {
  const out: Record<string, unknown> = {};
  for (const k of ["investigation", "rootCause", "riddorRef", "location", "immediateAction", "witnesses", "injuryDetails", "bodyPart"] as const) {
    if (k in body) out[k] = text(body[k], 5000);
  }
  if ("severity" in body) out.severity = ["low", "medium", "high"].includes(body.severity as string) ? body.severity : null;
  if ("status" in body && (body.status === "open" || body.status === "investigating")) out.status = body.status;
  if ("offWork" in body) out.offWork = !!body.offWork;
  if ("riddor" in body) {
    const r = body.riddor;
    out.riddor = isRiddor(r) ? r : null;
    out.riddorDueDate = riddorDue(out.riddor as string | null, occurredAt);
  }
  if ("riddorReportedAt" in body) out.riddorReportedAt = isDate(body.riddorReportedAt) ? new Date(body.riddorReportedAt as string) : null;
  return out;
}
