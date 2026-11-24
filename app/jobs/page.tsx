// Server side of the jobs list: jobs (with figures for those who may see money), companies and
// clients for the "new job" form arrive with the page.
import { serverApi } from "@/lib/serverApi";
import JobsView, { type JobRow } from "./JobsView";

export default async function JobsPage() {
  const [data, entities, clients] = await Promise.all([
    serverApi<{ seeMoney: boolean; jobs: JobRow[] }>("/api/jobs"),
    serverApi<{ id: number; name: string; archived: boolean }[]>("/api/entities"),
    serverApi<{ id: number; name: string }[]>("/api/clients"),
  ]);
  return (
    <JobsView
      initial={data && Array.isArray(data.jobs) ? data : null}
      entities={Array.isArray(entities) ? entities.filter(e => !e.archived) : []}
      clients={Array.isArray(clients) ? clients.map(c => ({ id: c.id, name: c.name })) : []}
    />
  );
}
