// Server side of the productions list: loads what the user may see and sends it with the page.
import { loadProductionsForViewer } from "@/lib/productionList";
import ProductionsView, { type Production } from "./ProductionsView";

export default async function ProductionsPage() {
  const productions = await loadProductionsForViewer();
  // Same JSON shape the API returns (dates as strings)
  return <ProductionsView initialProductions={JSON.parse(JSON.stringify(productions)) as Production[]} />;
}
