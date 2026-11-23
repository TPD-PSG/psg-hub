// Server side: the list arrives with the page (same API and checks as the browser).
import { serverApi } from "@/lib/serverApi";
import HotelsView, { type Hotel } from "./HotelsView";

export default async function HotelsPage() {
  const data = await serverApi<Hotel[]>("/api/hotels");
  return <HotelsView initial={Array.isArray(data) ? data : null} />;
}
