// Server side of Sales: brands and tasks arrive with the page (same API and checks as the browser).
import { serverApi } from "@/lib/serverApi";
import SalesView, { type SalesBrand, type SalesTask } from "./SalesView";

export default async function SalesPage() {
  const [brands, tasks] = await Promise.all([serverApi<SalesBrand[]>("/api/sales/brands"), serverApi<SalesTask[]>("/api/sales/tasks")]);
  return <SalesView initial={Array.isArray(brands) && Array.isArray(tasks) ? { brands, tasks } : null} />;
}
