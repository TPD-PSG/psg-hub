// Server side of the dashboard: loads everything through the app's own API as the signed-in user
// (same access checks as the browser), so the page arrives complete instead of filling in tile by tile.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { serverApi } from "@/lib/serverApi";
import DashboardView, { type DashboardData } from "./DashboardView";

const list = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);

export default async function HomePage() {
  const session = await auth();
  const user = session?.user as { id?: string; name?: string | null; role?: string; permissions?: string | null } | undefined;
  if (!user?.id) redirect("/login");
  const viewer = { id: Number(user.id), name: user.name ?? "", role: user.role ?? "member", permissions: user.permissions ?? null };

  const [tasks, allTasks, productions, property, quickLinks, settings, opportunities, invoices, expenses, salesBrands, salesTasks, calEvents] = await Promise.all([
    serverApi(`/api/tasks?assigneeId=${viewer.id}`),
    viewer.role === "admin" ? serverApi("/api/tasks") : Promise.resolve([]),
    serverApi("/api/productions"),
    serverApi<{ maintenance?: unknown[] }>("/api/property"),
    serverApi("/api/quicklinks"),
    serverApi<{ news?: string }>("/api/settings"),
    serverApi("/api/opportunities"),
    serverApi("/api/invoices"),
    serverApi("/api/expenses"),
    serverApi("/api/sales/brands"),
    serverApi("/api/sales/tasks"),
    serverApi("/api/calendar"),
  ]);

  const initial: DashboardData = {
    tasks: list(tasks), allTasks: list(allTasks), productions: list(productions),
    maintenance: list(property?.maintenance), quickLinks: list(quickLinks), news: settings?.news ?? null,
    opportunities: list(opportunities), invoices: list(invoices), expenses: list(expenses),
    salesBrands: list(salesBrands),
    salesTasksCount: list<{ completedAt: string | null }>(salesTasks).filter(t => !t.completedAt).length,
    calEvents: list(calEvents),
    // Sources a user's modules block (e.g. finance for a freelancer) come back null too; only treat
    // the always-available ones as a sign the server couldn't reach its own API
    complete: tasks !== null && productions !== null && quickLinks !== null && settings !== null && calEvents !== null,
  };
  return <DashboardView viewer={viewer} initial={initial} />;
}
