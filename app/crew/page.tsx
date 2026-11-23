// Server side: the list arrives with the page (same API and checks as the browser).
import { serverApi } from "@/lib/serverApi";
import CrewView, { type CrewMember } from "./CrewView";

export default async function CrewPage() {
  const data = await serverApi<CrewMember[]>("/api/crew");
  return <CrewView initial={Array.isArray(data) ? data : null} />;
}
