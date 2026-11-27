// Packages: ready-made groups of rental products for quoting (PSG Rentals & Crew)
import { rentalsData } from "../rentalsPage";
import Packages from "./Packages";

export default async function PackagesPage({ params }: { params: Promise<{ slug: string }> }) {
  return <Packages initial={await rentalsData((await params).slug)} />;
}
