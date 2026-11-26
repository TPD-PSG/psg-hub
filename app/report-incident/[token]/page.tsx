// The no-login accident & incident form crew open from a QR code on site (26 Nov 2026).
// The production's name and venues arrive with the page, for phones on a weak signal.
import { serverApi } from "@/lib/serverApi";
import ReportIncidentView from "./ReportIncidentView";

export const metadata = { title: "Report an accident or incident" };

export default async function ReportIncidentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = /^[A-Za-z0-9_-]{8,64}$/.test(token) ? await serverApi<{ name: string; venues: string[] }>(`/api/report-incident/${token}`) : null;
  return <ReportIncidentView token={token} info={info && typeof info === "object" && "name" in info ? info : null} />;
}
