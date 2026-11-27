// Handing over a leaver's work (27 Nov 2026): everything still open that a person is responsible
// for, counted and moved to someone else in one go. Finished work and history stay with them.
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { HS_LEADS_SETTING, hsLeadIds } from "./incidents";

type Tx = Prisma.TransactionClient;
const today = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };

export type HandoverKind = {
  key: string;
  label: string;
  /** Ticked by default: crew bookings are for a named person, so they're opt-in. */
  byDefault: boolean;
  count: (from: number) => Promise<number>;
  move: (tx: Tx, from: number, to: number) => Promise<unknown>;
};

export const HANDOVER: HandoverKind[] = [
  {
    key: "tasks", label: "Open tasks assigned to them", byDefault: true,
    count: from => prisma.task.count({ where: { assigneeUserId: from, status: { not: "done" } } }),
    move: (tx, from, to) => tx.task.updateMany({ where: { assigneeUserId: from, status: { not: "done" } }, data: { assigneeUserId: to } }),
  },
  {
    key: "signoffs", label: "Tasks waiting for their sign-off", byDefault: true,
    count: from => prisma.task.count({ where: { signoffUserId: from, status: { not: "done" } } }),
    move: (tx, from, to) => tx.task.updateMany({ where: { signoffUserId: from, status: { not: "done" } }, data: { signoffUserId: to } }),
  },
  {
    key: "shows", label: "Show teams they're on (the new person is added; they stay listed)", byDefault: true,
    count: from => prisma.productionTeam.count({ where: { userId: from, production: { archived: false } } }),
    move: async (tx, from, to) => {
      const teams = await tx.productionTeam.findMany({ where: { userId: from, production: { archived: false } }, select: { productionId: true } });
      for (const t of teams) await tx.productionTeam.upsert({ where: { productionId_userId: { productionId: t.productionId, userId: to } }, create: { productionId: t.productionId, userId: to }, update: {} });
    },
  },
  {
    key: "bookings", label: "Upcoming crew bookings", byDefault: false,
    count: from => prisma.staffAssignment.count({ where: { userId: from, endDate: { gte: today() } } }),
    move: (tx, from, to) => tx.staffAssignment.updateMany({ where: { userId: from, endDate: { gte: today() } }, data: { userId: to } }),
  },
  {
    key: "buildParts", label: "Unfinished workshop build parts", byDefault: true,
    count: from => prisma.buildPart.count({ where: { userId: from, done: false } }),
    move: (tx, from, to) => tx.buildPart.updateMany({ where: { userId: from, done: false }, data: { userId: to } }),
  },
  {
    key: "deals", label: "Open BD opportunities they own", byDefault: true,
    count: from => prisma.opportunity.count({ where: { ownerUserId: from, stage: { notIn: ["won", "lost"] } } }),
    move: (tx, from, to) => tx.opportunity.updateMany({ where: { ownerUserId: from, stage: { notIn: ["won", "lost"] } }, data: { ownerUserId: to } }),
  },
  {
    key: "clients", label: "Clients they look after", byDefault: true,
    count: from => prisma.client.count({ where: { targetOwnerId: from } }),
    move: (tx, from, to) => tx.client.updateMany({ where: { targetOwnerId: from }, data: { targetOwnerId: to } }),
  },
  {
    key: "tickets", label: "Open help tickets assigned to them", byDefault: true,
    count: from => prisma.helpTicket.count({ where: { assignedToUserId: from, status: { in: ["open", "in_progress"] } } }),
    move: (tx, from, to) => tx.helpTicket.updateMany({ where: { assignedToUserId: from, status: { in: ["open", "in_progress"] } }, data: { assignedToUserId: to } }),
  },
  {
    key: "hsActions", label: "Open H&S follow-up actions", byDefault: true,
    count: from => prisma.incidentAction.count({ where: { ownerId: from, doneAt: null } }),
    move: (tx, from, to) => tx.incidentAction.updateMany({ where: { ownerId: from, doneAt: null }, data: { ownerId: to } }),
  },
  {
    key: "compliance", label: "Compliance register items they own", byDefault: true,
    count: from => prisma.complianceItem.count({ where: { ownerId: from, archived: false } }),
    move: (tx, from, to) => tx.complianceItem.updateMany({ where: { ownerId: from, archived: false }, data: { ownerId: to } }),
  },
  {
    key: "hsLead", label: "H&S lead", byDefault: true,
    count: async from => ((await hsLeadIds()).includes(from) ? 1 : 0),
    move: async (tx, from, to) => {
      const ids = await hsLeadIds();
      const next = [...new Set(ids.map(id => (id === from ? to : id)))];
      await tx.setting.update({ where: { key: HS_LEADS_SETTING }, data: { value: JSON.stringify(next) } });
    },
  },
];

/** What a person still has open, kind by kind (only kinds with something in them). */
export async function handoverSummary(from: number) {
  const counts = await Promise.all(HANDOVER.map(k => k.count(from)));
  const trainerOn = await prisma.machineTrainer.findMany({ where: { userId: from }, select: { machine: { select: { name: true } } } });
  return {
    kinds: HANDOVER.map((k, i) => ({ key: k.key, label: k.label, count: counts[i], byDefault: k.byDefault })).filter(k => k.count > 0),
    // Not moved: a trainer has to be qualified on the machine, so this is for the admin to sort out
    trainerOn: trainerOn.map(t => t.machine.name),
  };
}

/** Moves the chosen kinds from one person to another, all or nothing. Returns what moved. */
export async function handOver(from: number, to: number, keys: string[]) {
  const picked = HANDOVER.filter(k => keys.includes(k.key));
  const counts = await Promise.all(picked.map(k => k.count(from)));
  const chosen = picked.map((k, i) => ({ k, count: counts[i] })).filter(c => c.count > 0);
  await prisma.$transaction(async tx => { for (const { k } of chosen) await k.move(tx, from, to); });
  return chosen.map(({ k, count }) => ({ key: k.key, label: k.label, count }));
}
