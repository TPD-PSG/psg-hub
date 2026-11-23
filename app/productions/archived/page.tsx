// Server side of the archived productions list.
import { loadProductionsForViewer } from "@/lib/productionList";
import ArchivedView, { type Production } from "./ArchivedView";

export default async function ArchivedProductionsPage() {
  const productions = await loadProductionsForViewer({ archived: true });
  return <ArchivedView initialProductions={JSON.parse(JSON.stringify(productions)) as Production[]} />;
}
