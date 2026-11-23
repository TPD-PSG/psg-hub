// Server side of Ask Me Anything: the knowledge-base document list arrives with the page.
import { serverApi } from "@/lib/serverApi";
import AskView, { type Doc } from "./AskView";

export default async function AskPage() {
  const docs = await serverApi<Doc[]>("/api/knowledge-docs");
  return <AskView initial={Array.isArray(docs) ? docs : null} />;
}
