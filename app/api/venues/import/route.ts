import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const rows: Record<string, string>[] = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  const created: number[] = [];
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.name?.trim()) {
      errors.push({ row: i + 1, error: "Name is required" });
      continue;
    }
    try {
      const venue = await prisma.venue.create({
        data: {
          name: r.name.trim(),
          type: r.type?.trim() || "theatre",
          city: r.city?.trim() || null,
          address: r.address?.trim() || null,
          postcode: r.postcode?.trim() || null,
          phone: r.phone?.trim() || null,
          email: r.email?.trim() || null,
          website: r.website?.trim() || null,
          capacity: r.capacity ? Number(r.capacity) : null,
          techNotes: r.techNotes?.trim() || null,
          notes: r.notes?.trim() || null,
        },
      });
      created.push(venue.id);
    } catch {
      errors.push({ row: i + 1, error: "Failed to create venue" });
    }
  }

  return NextResponse.json({ created: created.length, errors });
}
