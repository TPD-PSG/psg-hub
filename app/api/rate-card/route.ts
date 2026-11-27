// The hire rate card (?companyId=): PSG staff who can open that rentals space, and client logins.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { clientViewer } from "@/lib/clientPortal";
import { staffForEntity } from "@/lib/rentalAccess";
import { rateCard, rentalCompanies } from "@/lib/rentalClients";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companies = await rentalCompanies();
  const id = Number(new URL(req.url).searchParams.get("companyId")) || companies[0]?.id;
  if (!id || !companies.some(c => c.id === id)) return NextResponse.json({ error: "No rate card here" }, { status: 404 });
  if (role === "client") { const v = await clientViewer(); if ("error" in v) return v.error; }
  else { const a = await staffForEntity(id); if ("error" in a) return a.error; }
  return NextResponse.json(await rateCard(id));
}
