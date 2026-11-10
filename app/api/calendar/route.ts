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
      id: true, name: true,
      keyDates: { orderBy: { startDate: "asc" } },
      tourStops: {
        where: { OR: [{ startDate: { not: null } }, { loadInDate: { not: null } }, { performanceStart: { not: null } }] },
        orderBy: { stopNumber: "asc" },
        select: { id: true, stopNumber: true, loadInDate: true, startDate: true, endDate: true, performanceStart: true, performanceEnd: true, notes: true, venue: { select: { name: true, city: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const tasks = await prisma.task.findMany({
    where: { status: { not: "done" }, dueDate: { not: null } },
    select: { id: true, title: true, dueDate: true, status: true, productionId: true, production: { select: { name: true } } },
  });

  const events: object[] = [];

  productions.forEach((prod, idx) => {
    const color = PROD_COLORS[idx % PROD_COLORS.length];
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
        href: `/productions/${prod.id}?section=schedule`,
      });
    });
  });

  productions.forEach((prod, idx) => {
    const color = PROD_COLORS[idx % PROD_COLORS.length];
    prod.tourStops.forEach(stop => {
      const venueName = stop.venue?.name ?? "Unknown Venue";
      const city = stop.venue?.city ? ` · ${stop.venue.city}` : "";
      const href = `/productions/${prod.id}?section=tour`;
      if (stop.loadInDate) {
        events.push({ id: `tour-li-${stop.id}`, type: "tour_stop", title: `${prod.name} — Load in · ${venueName}${city}`, production: prod.name, productionId: prod.id, startDate: stop.loadInDate, endDate: null, notes: stop.notes, color, href });
      }
      if (stop.performanceStart) {
        events.push({ id: `tour-perf-${stop.id}`, type: "tour_stop", title: `${prod.name} · ${venueName}${city}`, production: prod.name, productionId: prod.id, startDate: stop.performanceStart, endDate: stop.performanceEnd, notes: stop.notes, color, href });
      }
      if (stop.endDate) {
        events.push({ id: `tour-go-${stop.id}`, type: "tour_stop", title: `${prod.name} — Get out · ${venueName}${city}`, production: prod.name, productionId: prod.id, startDate: stop.endDate, endDate: null, notes: stop.notes, color, href });
      }
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
