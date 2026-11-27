// A client login's hires (quotes sent to them, confirmed and past), and the rentals companies
// they can see the rate card of and ask for quotes from.
import { NextResponse } from "next/server";
import { clientViewer } from "@/lib/clientPortal";
import { clientHires, rentalCompanies, brandOf } from "@/lib/rentalClients";

export const dynamic = "force-dynamic";

export async function GET() {
  const v = await clientViewer();
  if ("error" in v) return v.error;
  const [hires, companies] = await Promise.all([clientHires(v.clientId), rentalCompanies()]);
  return NextResponse.json({
    me: { name: v.name, company: v.clientName },
    hires, companies: companies.map(c => ({ id: c.id, name: c.name })),
    brand: brandOf(companies[0]),
  });
}
