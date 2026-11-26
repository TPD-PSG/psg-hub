// The central Health & Safety page (26 Nov 2026): the same API and checks as the browser.
import { serverApi } from "@/lib/serverApi";
import HealthSafetyView, { type HSData } from "./HealthSafetyView";

export const metadata = { title: "Health & Safety · PSG Hub" };

export default async function HealthSafetyPage() {
  const data = await serverApi<HSData>("/api/health-safety");
  return <HealthSafetyView initial={data && typeof data === "object" && "incidents" in data ? data : null} />;
}
