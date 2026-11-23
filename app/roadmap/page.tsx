// Server side: the list arrives with the page (same API and checks as the browser).
import { serverApi } from "@/lib/serverApi";
import RoadmapView, { type RoadmapItem } from "./RoadmapView";

export default async function RoadmapPage() {
  const data = await serverApi<RoadmapItem[]>("/api/roadmap");
  return <RoadmapView initial={Array.isArray(data) ? data : null} />;
}
