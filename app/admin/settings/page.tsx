// Server side of Admin → Hub Settings: settings, quick links and system status arrive with the
// page (same API and checks as the browser).
import { serverApi } from "@/lib/serverApi";
import type { JobStatus } from "@/lib/job-status";
import SettingsView, { type QuickLink } from "./SettingsView";

export default async function AdminSettingsPage() {
  const [settings, links, status] = await Promise.all([
    serverApi<Record<string, string>>("/api/settings"),
    serverApi<QuickLink[]>("/api/quicklinks"),
    serverApi<{ jobs: JobStatus[] }>("/api/admin/status"),
  ]);
  const ok = settings && typeof settings === "object" && !Array.isArray(settings) && Array.isArray(links);
  return <SettingsView initial={ok ? { settings, links, jobs: Array.isArray(status?.jobs) ? status.jobs : null } : null} />;
}
