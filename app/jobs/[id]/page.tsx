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
  const [data, users] = await Promise.all([
    serverApi<{ seeMoney: boolean; job: JobDetail }>(`/api/jobs/${id}`),
    me?.role === "admin" ? serverApi<{ id: number; name: string; role: string }[]>("/api/users") : Promise.resolve(null),
  ]);
  if (!data?.job) notFound();
  const staff = Array.isArray(users) ? users.filter(u => u.role === "admin" || u.role === "member").map(u => ({ id: u.id, name: u.name })) : [];
  return <JobView initial={data.job} seeMoney={data.seeMoney} me={{ id: Number(me?.id), isAdmin: me?.role === "admin" }} staff={staff} />;
}
