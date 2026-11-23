// Server side of Property: the property record arrives with the page (same API and checks as the browser).
import { serverApi } from "@/lib/serverApi";
import PropertyView, { type Property } from "./PropertyView";

export default async function PropertyPage() {
  const prop = await serverApi<Property>("/api/property");
  return <PropertyView initial={prop && typeof prop === "object" && "contacts" in prop ? prop : null} />;
}
