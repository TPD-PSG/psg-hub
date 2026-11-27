// Machine inductions in a workshop space (26 Nov 2026).
//   The workshop's staff (members whose home company it is) and admins look after its machines and
//   see everyone's inductions; a machine's named trainers (and admins) record inductions on it;
//   anyone else in the space sees the machines and their own inductions.
// Warn, don't block: the planner and tablet flag work that needs a machine someone isn't inducted on.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { spaceBySlug, canSeeSpace, type SpaceTheme } from "@/lib/spaces";
import { current, inductionStatus, missing, personKey, refresherDate } from "@/lib/inductionsCore";

export type Viewer = { userId: number; role: string; staff: boolean; space: SpaceTheme };

/** Someone who can open the space; `staff` = may look after its machines. */
export async function workshopViewer(slug: string): Promise<Viewer | { error: NextResponse }> {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const space = await spaceBySlug(slug);
  if (!space) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const role = u.role ?? "member", userId = Number(u.id);
  if (!(await canSeeSpace({ id: userId, role }, space.id))) return { error: NextResponse.json({ error: "This space isn't yours" }, { status: 403 }) };
  return { userId, role, space, staff: await isWorkshopStaff(userId, role, space.id) };
}

export async function isWorkshopStaff(userId: number, role: string, entityId: number) {
  if (role === "admin") return true;
  if (role !== "member") return false;
  return (await prisma.user.findUnique({ where: { id: userId }, select: { homeEntityId: true } }))?.homeEntityId === entityId;
}

/** May this person record an induction on this machine: one of its trainers, or an admin. */
export async function canInduct(userId: number, role: string, machineId: number) {
  if (role === "admin") return true;
  return !!(await prisma.machineTrainer.findUnique({ where: { machineId_userId: { machineId, userId } } }));
}

const IND_SELECT = { id: true, machineId: true, userId: true, personName: true, personCompany: true, trainerName: true, inductedAt: true, expiresAt: true, revokedAt: true, notes: true } as const;

/** The machines, the people, and who's inducted on what (each person's current induction per machine). */
export async function matrix(v: Viewer) {
  const entityId = v.space.id;
  const machines = await prisma.machine.findMany({
    where: { entityId, needsInduction: true }, orderBy: [{ archived: "asc" }, { name: "asc" }],
    select: { id: true, name: true, location: true, refresherMonths: true, notes: true, archived: true, trainers: { select: { user: { select: { id: true, name: true } } } } },
  });
  const all = await prisma.machineInduction.findMany({
    where: { machine: { entityId }, ...(v.staff ? {} : { userId: v.userId }) },
    select: IND_SELECT, orderBy: { inductedAt: "desc" },
  });
  // People: the workshop's own team (staff and freelancers), plus anyone with an induction here
  const team = v.staff ? await prisma.user.findMany({ where: { homeEntityId: entityId, role: { in: ["admin", "member", "freelancer"] } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }) : [];
  const people = new Map<string, { key: string; userId: number | null; name: string; company: string | null; team: boolean }>();
  for (const t of team) people.set(`u${t.id}`, { key: `u${t.id}`, userId: t.id, name: t.name, company: null, team: true });
  if (!v.staff) people.set(`u${v.userId}`, { key: `u${v.userId}`, userId: v.userId, name: (await prisma.user.findUnique({ where: { id: v.userId }, select: { name: true } }))?.name ?? "", company: null, team: true });
  for (const i of all) {
    const k = personKey(i);
    if (!people.has(k)) people.set(k, { key: k, userId: i.userId, name: i.personName, company: i.personCompany, team: false });
  }
  const now = new Date();
  // Group once by person and machine, then look each square up (audit round 2: this used to
  // re-scan every induction for every square)
  const byPair = new Map<string, typeof all>();
  for (const i of all) { const k = `${personKey(i)}|${i.machineId}`; byPair.set(k, [...(byPair.get(k) ?? []), i]); }
  const cells: Record<string, Record<number, { id: number; status: ReturnType<typeof inductionStatus>; inductedAt: Date; expiresAt: Date | null; trainerName: string }>> = {};
  for (const p of people.values()) {
    cells[p.key] = {};
    for (const m of machines) {
      const c = current(byPair.get(`${p.key}|${m.id}`) ?? []);
      if (c) cells[p.key][m.id] = { id: c.id, status: inductionStatus(c, now), inductedAt: c.inductedAt, expiresAt: c.expiresAt, trainerName: c.trainerName };
    }
  }
  const canTrain = v.role === "admin" ? machines.map(m => m.id) : machines.filter(m => m.trainers.some(t => t.user.id === v.userId)).map(m => m.id);
  const staffList = v.staff ? await prisma.user.findMany({ where: { OR: [{ homeEntityId: entityId, role: "member" }, { role: "admin" }] }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  return {
    space: v.space, staff: v.staff, me: v.userId, canTrain, machines,
    people: [...people.values()].sort((a, b) => Number(b.team) - Number(a.team) || a.name.localeCompare(b.name)),
    cells, trainersPick: staffList,
  };
}

/** Record an induction (trainer and trainee have signed). */
export async function recordInduction(machine: { id: number; refresherMonths: number }, by: { id: number; name: string }, body: Record<string, unknown>) {
  const sig = (v: unknown) => (typeof v === "string" && /^data:image\/png;base64,/.test(v) && v.length < 400_000 ? v : null);
  const traineeSignature = sig(body.traineeSignature), trainerSignature = sig(body.trainerSignature);
  if (!traineeSignature || !trainerSignature) return { error: "Both of you need to sign" };
  const inductedAt = typeof body.inductedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.inductedAt) ? new Date(`${body.inductedAt}T00:00:00Z`) : null;
  if (!inductedAt || inductedAt.getTime() > Date.now() + 86400e3) return { error: "Pick the date of the induction (not in the future)" };
  let userId: number | null = null, personName = typeof body.personName === "string" ? body.personName.trim().slice(0, 120) : "";
  if (body.userId) {
    const u = await prisma.user.findUnique({ where: { id: Number(body.userId) }, select: { id: true, name: true } });
    if (!u) return { error: "Unknown person" };
    userId = u.id; personName = u.name;
  }
  if (!personName) return { error: "Who was inducted?" };
  const company = typeof body.personCompany === "string" ? body.personCompany.trim().slice(0, 120) || null : null;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null;
  const ind = await prisma.machineInduction.create({
    data: { machineId: machine.id, userId, personName, personCompany: userId ? null : company, trainerId: by.id, trainerName: by.name, inductedAt, expiresAt: refresherDate(inductedAt, machine.refresherMonths), notes, traineeSignature, trainerSignature },
    select: IND_SELECT,
  });
  return { induction: ind };
}

/** For warnings: which machines each (person, part) pair is missing an induction on. */
export async function partGaps(parts: { id: number; userId: number | null; machines: { machine: { id: number; name: string } }[] }[]) {
  const users = [...new Set(parts.filter(p => p.userId && p.machines.length).map(p => p.userId!))];
  if (!users.length) return {} as Record<number, string[]>;
  const mIds = [...new Set(parts.flatMap(p => p.machines.map(m => m.machine.id)))];
  const inds = await prisma.machineInduction.findMany({ where: { userId: { in: users }, machineId: { in: mIds } }, select: { userId: true, machineId: true, inductedAt: true, expiresAt: true, revokedAt: true } });
  const out: Record<number, string[]> = {};
  for (const p of parts) {
    if (!p.userId || !p.machines.length) continue;
    const gap = missing(inds.filter(i => i.userId === p.userId), p.machines.map(m => m.machine.id));
    if (gap.length) out[p.id] = p.machines.filter(m => gap.includes(m.machine.id)).map(m => m.machine.name);
  }
  return out;
}
