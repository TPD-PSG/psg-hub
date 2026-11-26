// The group compliance register (26 Nov 2026): the same API and checks as the browser.
import { Suspense } from "react";
import { serverApi } from "@/lib/serverApi";
import ComplianceView, { type RegisterData } from "./ComplianceView";

export const metadata = { title: "Compliance register · PSG Hub" };

export default async function CompliancePage() {
  const data = await serverApi<RegisterData>("/api/compliance");
  if (!data || !("items" in data)) return <p className="text-sm" style={{ color: "var(--psg-muted)" }}>The compliance register is for PSG staff.</p>;
  return <Suspense><ComplianceView initial={data} /></Suspense>;
}
