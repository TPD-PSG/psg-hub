// Server side: the list arrives with the page (same API and checks as the browser).
import { serverApi } from "@/lib/serverApi";
import SuppliersView, { type Supplier } from "./SuppliersView";

export default async function SuppliersPage() {
  const data = await serverApi<Supplier[]>("/api/suppliers");
  return <SuppliersView initial={Array.isArray(data) ? data : null} />;
}
