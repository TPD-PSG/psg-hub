// Server side: the list arrives with the page (same API and checks as the browser).
import { serverApi } from "@/lib/serverApi";
import CrewView, { type CrewMember } from "./CrewView";

export default async function CrewPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const data = await serverApi<CrewMember[]>("/api/crew");
  // ?q= opens the directory searched for someone (from a production's crew list, or search)
  const q = ((await searchParams).q ?? "").slice(0, 80);
  return <CrewView initial={Array.isArray(data) ? data : null} initialSearch={q} />;
}
