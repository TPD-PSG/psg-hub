// Server side: the list arrives with the page (same API and checks as the browser).
import { serverApi } from "@/lib/serverApi";
import HaulageView, { type Movement } from "./HaulageView";

export default async function HaulagePage() {
  const data = await serverApi<Movement[]>("/api/haulage");
  return <HaulageView initial={Array.isArray(data) ? data : null} />;
}
