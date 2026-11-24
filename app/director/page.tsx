// Server side of the Director overview (admins only): everything arrives with the page.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { serverApi } from "@/lib/serverApi";
import DirectorView, { type DirectorInitial } from "./DirectorView";
import type { Forecast } from "@/lib/forecast";

export default async function DirectorPage() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "admin") redirect("/");
  const [productions, invoices, opportunities, tasks, tickets, expenses] = await Promise.all(
    ["/api/productions", "/api/invoices", "/api/opportunities", "/api/tasks", "/api/help-tickets", "/api/expenses"].map(u => serverApi<unknown[]>(u)),
  );
  const all = [productions, invoices, opportunities, tasks, tickets, expenses];
  const initial = all.every(Array.isArray)
    ? ({ productions, invoices, opportunities, tasks, tickets, expenses } as unknown as NonNullable<DirectorInitial>)
    : null;
  const forecast = await serverApi<Forecast>("/api/bd/forecast");
  return <DirectorView initial={initial} forecast={forecast && Array.isArray(forecast.rows) ? forecast : null} />;
}
