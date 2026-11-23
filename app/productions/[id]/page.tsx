// Server side of the production page: loads the production (same access rules as the API)
// and sends it with the page, so it appears straight away instead of after a "Loading…" flash.
import { notFound } from "next/navigation";
import { loadProductionForViewer } from "@/lib/productionData";
import ProductionView from "./ProductionView";
import type { Production } from "./shared";

export default async function ProductionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadProductionForViewer(id);
  if (result.status === 404 || result.status === 400) notFound();
  if (result.status !== 200) {
    return (
      <div className="py-20 text-center" style={{ color: "var(--psg-muted)" }}>
        You don&apos;t have access to this production. Ask an admin to add you to its team.
      </div>
    );
  }
  // Same JSON shape the API returns (dates as strings), so the client code is unchanged
  const initialProd = JSON.parse(JSON.stringify(result.data)) as Production;
  return <ProductionView key={id} id={id} initialProd={initialProd} />;
}
