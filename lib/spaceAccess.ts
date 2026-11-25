// The space a stock or PO request is for, checked against the signed-in staff member.
import { NextResponse } from "next/server";
import { spaceBySlug, canSeeSpace } from "@/lib/spaces";
import { requirePoUser, type PoUser } from "@/lib/purchaseOrders";

export async function staffInSpace(slug: string): Promise<{ user: PoUser; space: NonNullable<Awaited<ReturnType<typeof spaceBySlug>>> } | { error: NextResponse }> {
  const user = await requirePoUser();
  if ("error" in user) return user;
  const space = await spaceBySlug(slug);
  if (!space) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!(await canSeeSpace({ id: user.userId, role: user.role }, space.id))) return { error: NextResponse.json({ error: "This space isn't yours" }, { status: 403 }) };
  return { user, space };
}
