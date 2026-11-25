// The space a stock or PO request is for, checked against the signed-in staff member.
import { NextResponse } from "next/server";
import { spaceBySlug } from "@/lib/spaces";
import { requirePoUser, type PoUser } from "@/lib/purchaseOrders";

export async function staffInSpace(slug: string): Promise<{ user: PoUser; space: NonNullable<Awaited<ReturnType<typeof spaceBySlug>>> } | { error: NextResponse }> {
  const user = await requirePoUser();
  if ("error" in user) return user;
  const space = await spaceBySlug(slug);
  if (!space) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { user, space };
}
