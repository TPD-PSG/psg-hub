import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public endpoint — returns only id, name, avatarUrl for the login user picker
export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}
