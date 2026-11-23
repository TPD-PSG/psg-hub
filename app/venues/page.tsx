// Server side of the venues page: the list arrives with the page (same API and checks as the browser).
import { serverApi } from "@/lib/serverApi";
import VenuesView, { type Venue } from "./VenuesView";

export default async function VenuesPage() {
  const venues = await serverApi<Venue[]>("/api/venues");
  return <VenuesView initialVenues={Array.isArray(venues) ? venues : null} />;
}
