// Server side of the Help Desk: tickets arrive with the page (same API and checks as the browser).
// Admins see every ticket by default; everyone else sees their own.
import { auth } from "@/auth";
import { serverApi } from "@/lib/serverApi";
import HelpdeskView, { type Ticket } from "./HelpdeskView";

export default async function HelpdeskPage() {
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  const tickets = await serverApi<Ticket[]>(`/api/help-tickets${isAdmin ? "?all=1" : ""}`);
  return <HelpdeskView isAdmin={isAdmin} initial={Array.isArray(tickets) ? { tickets, all: isAdmin } : null} />;
}
