// Server side of one job: the job, and (for admins) the staff list for logging time for others.
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { serverApi } from "@/lib/serverApi";
import JobView, { type JobDetail } from "./JobView";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const session = await auth();
  const me = session?.user as { id?: string; role?: string } | undefined;
  const [data, users, prods] = await Promise.all([
    serverApi<{ seeMoney: boolean; job: JobDetail }>(`/api/jobs/${id}`),
    me?.role === "admin" ? serverApi<{ id: number; name: string; role: string }[]>("/api/users") : Promise.resolve(null),
    serverApi<{ id: number; name: string; status?: string }[]>("/api/productions"),
  ]);
  if (!data?.job) notFound();
  const staff = Array.isArray(users) ? users.filter(u => u.role === "admin" || u.role === "member").map(u => ({ id: u.id, name: u.name })) : [];
  // Shows a build can be for (live ones, newest list order as the Productions page)
  const productions = Array.isArray(prods) ? prods.filter(p => p.status !== "closed").map(p => ({ id: p.id, name: p.name })) : [];
  return <JobView productions={productions} initial={data.job} seeMoney={data.seeMoney} me={{ id: Number(me?.id), isAdmin: me?.role === "admin" }} staff={staff} />;
}
