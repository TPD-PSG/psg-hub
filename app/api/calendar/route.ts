import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { parsePerms } from "@/lib/permissions";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// Stable colour palette per production (cycles through these)
const PROD_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
];

function hasBit(pattern: number, bit: number) { return !!(pattern & (1 << bit)); }

// Returns YYYY-MM-DD strings for all performance dates given a schedule + overrides + run boundaries
function computePerformanceDates(
  weekPattern: number,
  matineePattern: number,
  overrides: { date: string; type: string }[],
  openingStr: string,
  closingStr: string,
): { date: string; evening: boolean; matinee: boolean }[] {
  const overrideMap = new Map<string, string>();
  overrides.forEach(o => overrideMap.set(`${o.date}:${o.type.startsWith("matinee") ? "matinee" : "evening"}`, o.type));

  const results: { date: string; evening: boolean; matinee: boolean }[] = [];
  const start = new Date(openingStr);
  const end = new Date(closingStr);
  const cur = new Date(start);

  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10);
    const jsDay = cur.getDay(); // 0=Sun
    const bit = jsDay === 0 ? 6 : jsDay - 1; // Mon=0 ... Sun=6

    const eveningOverride = overrideMap.get(`${dateStr}:evening`);
    const isEvening = eveningOverride === "add" ? true : eveningOverride === "remove" ? false : hasBit(weekPattern, bit);

    const matineeOverride = overrideMap.get(`${dateStr}:matinee`);
    const isMatinee = matineeOverride === "matinee_add" ? true : matineeOverride === "matinee_remove" ? false : hasBit(matineePattern, bit);

    if (isEvening || isMatinee) {
      results.push({ date: dateStr, evening: isEvening, matinee: isMatinee });
    }

    cur.setDate(cur.getDate() + 1);
  }
  return results;
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role ?? "member";
  const userId = (session?.user as any)?.id ? Number((session!.user as any).id) : undefined;
  const perms = parsePerms((session?.user as any)?.permissions ?? null);

  const where = role !== "admin" && !perms.allProductions && userId
    ? { team: { some: { userId } } }
    : undefined;

  const productions = await prisma.production.findMany({
    where,
    select: {
      id: true, name: true, color: true, venue: true, isTour: true,
      venueRef: { select: { name: true, city: true } },
      keyDates: { orderBy: { startDate: "asc" } },
      tourStops: {
        where: { OR: [{ startDate: { not: null } }, { loadInDate: { not: null } }, { performanceStart: { not: null } }] },
        orderBy: { stopNumber: "asc" },
        select: { id: true, stopNumber: true, loadInDate: true, startDate: true, endDate: true, performanceStart: true, performanceEnd: true, notes: true, venue: { select: { name: true, city: true } } },
      },
      performanceSchedule: { select: { weekPattern: true, matineePattern: true } },
      performanceOverrides: { select: { date: true, type: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const tasks = await prisma.task.findMany({
    where: { status: { not: "done" }, dueDate: { not: null } },
    select: { id: true, title: true, dueDate: true, status: true, productionId: true, production: { select: { name: true } } },
  });

  const events: object[] = [];

  productions.forEach((prod, idx) => {
    const color = (prod as { color?: string | null }).color || PROD_COLORS[idx % PROD_COLORS.length];
    const prodVenue = prod.venueRef ? `${prod.venueRef.name}${prod.venueRef.city ? ` · ${prod.venueRef.city}` : ""}` : (prod.venue ?? undefined);
    prod.keyDates.forEach(kd => {
      events.push({
        id: `kd-${kd.id}`,
        type: "key_date",
        kdType: kd.type,
        title: `${prod.name} — ${kd.label || KEY_DATE_LABELS[kd.type] || kd.type}`,
        production: prod.name,
        productionId: prod.id,
        startDate: kd.startDate,
        endDate: kd.endDate,
        notes: kd.notes,
        color,
        venue: prodVenue,
        href: `/productions/${prod.id}?section=schedule`,
      });
    });
  });

  productions.forEach((prod, idx) => {
    const color = (prod as { color?: string | null }).color || PROD_COLORS[idx % PROD_COLORS.length];
    prod.tourStops.forEach(stop => {
      const venueName = stop.venue?.name ?? "Unknown Venue";
      const city = stop.venue?.city ? ` · ${stop.venue.city}` : "";
      const href = `/productions/${prod.id}?section=tour`;
      const venueLabel = `${venueName}${city}`;
      if (stop.loadInDate) {
        events.push({ id: `tour-li-${stop.id}`, type: "tour_stop", title: `${prod.name} — Load in · ${venueLabel}`, production: prod.name, productionId: prod.id, startDate: stop.loadInDate, endDate: null, notes: stop.notes, color, href, venue: venueLabel });
      }
      if (stop.performanceStart) {
        events.push({ id: `tour-perf-${stop.id}`, type: "tour_stop", title: `${prod.name} · ${venueLabel}`, production: prod.name, productionId: prod.id, startDate: stop.performanceStart, endDate: stop.performanceEnd, notes: stop.notes, color, href, venue: venueLabel });
      }
      if (stop.endDate) {
        events.push({ id: `tour-go-${stop.id}`, type: "tour_stop", title: `${prod.name} — Get out · ${venueLabel}`, production: prod.name, productionId: prod.id, startDate: stop.endDate, endDate: null, notes: stop.notes, color, href, venue: venueLabel });
      }
    });
  });

  // Performance schedule events for non-touring productions
  productions.forEach((prod, idx) => {
    if (prod.isTour || !prod.performanceSchedule) return;
    const color = (prod as { color?: string | null }).color || PROD_COLORS[idx % PROD_COLORS.length];
    const { weekPattern, matineePattern } = prod.performanceSchedule;
    if (weekPattern === 0) return; // no pattern set yet

    // Derive run boundaries from key dates
    const OPENING_TYPES = ["preview", "press_night", "performance"];
    const openingKd = prod.keyDates.find(k => OPENING_TYPES.includes(k.type));
    const closingKd = prod.keyDates.find(k => k.type === "get_out")
      ?? prod.keyDates.filter(k => k.type === "performance" && k.endDate).slice(-1)[0];
    const openingStr = openingKd?.startDate ? new Date(openingKd.startDate).toISOString().slice(0, 10) : null;
    const closingStr = closingKd
      ? new Date(closingKd.type === "get_out" ? closingKd.startDate : (closingKd.endDate ?? closingKd.startDate)).toISOString().slice(0, 10)
      : null;
    if (!openingStr || !closingStr) return;

    const prodVenue = prod.venueRef
      ? `${prod.venueRef.name}${prod.venueRef.city ? ` · ${prod.venueRef.city}` : ""}`
      : (prod.venue ?? undefined);
    const href = `/productions/${prod.id}?section=schedule`;

    const dates = computePerformanceDates(weekPattern, matineePattern, prod.performanceOverrides, openingStr, closingStr);
    dates.forEach(({ date, evening, matinee }) => {
      const label = evening && matinee ? " (eve + mat)" : !evening && matinee ? " (matinee only)" : "";
      events.push({
        id: `perf-${prod.id}-${date}`,
        type: "performance",
        title: `${prod.name}${label}`,
        production: prod.name,
        productionId: prod.id,
        startDate: date,
        endDate: null,
        evening,
        matinee,
        color,
        venue: prodVenue,
        href,
      });
    });
  });

  tasks.forEach(t => {
    if (!t.dueDate) return;
    events.push({
      id: `task-${t.id}`,
      type: "task",
      title: t.title,
      production: t.production?.name ?? null,
      productionId: t.productionId,
      startDate: t.dueDate,
      endDate: null,
      color: "#6b7280",
      href: "/tasks",
    });
  });

  return NextResponse.json(events);
}

const KEY_DATE_LABELS: Record<string, string> = {
  design_presentation: "Design Presentation",
  pre_production: "Pre-Production",
  first_rehearsal: "First Rehearsal",
  rehearsal_period: "Rehearsal Period",
  load_in: "Load In",
  fit_up: "Fit Up",
  technical_rehearsal: "Technical Rehearsal",
  dress_rehearsal: "Dress Rehearsal",
  preview: "Preview",
  press_night: "Press Night",
  performance: "Performance",
  get_out: "Get Out",
  other: "Other",
};
