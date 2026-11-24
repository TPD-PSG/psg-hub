// Server side of the toolbox-talk sign-off form (opened from a QR code on site): the production's
// name and venues arrive with the page, so phones on a weak signal see the form straight away.
import { serverApi } from "@/lib/serverApi";
import ToolboxView, { type ToolboxProduction } from "./ToolboxView";

export default async function ToolboxTalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prod = /^\d+$/.test(id) ? await serverApi<ToolboxProduction>(`/api/productions/${id}/toolbox-info`) : null;
  return <ToolboxView initial={prod && typeof prod === "object" && "name" in prod ? prod : null} />;
}
