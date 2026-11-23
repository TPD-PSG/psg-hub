import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parsePerms } from "@/lib/permissions";

type Access = { session: Session; role: string; userId: number } | { error: NextResponse };

// Same rule as the productions list: admins and all-productions staff see everything; everyone else only their teams.
export async function requireProductionAccess(productionId: string | number): Promise<Access> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; permissions?: string | null } | undefined;
  if (!session || !user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const pid = Number(productionId);
  if (!Number.isInteger(pid)) return { error: NextResponse.json({ error: "Invalid production" }, { status: 400 }) };

  const role = user.role ?? "member";
  const userId = Number(user.id);
  if (role === "admin" || (role === "member" && parsePerms(user.permissions).allProductions)) {
    return { session, role, userId };
  }

  const onTeam = await prisma.productionTeam.findUnique({
    where: { productionId_userId: { productionId: pid, userId } },
    select: { id: true },
  });
  if (!onTeam) return { error: NextResponse.json({ error: "You don't have access to this production" }, { status: 403 }) };
  return { session, role, userId };
}
