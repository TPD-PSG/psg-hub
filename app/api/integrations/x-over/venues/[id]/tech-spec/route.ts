import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadFile } from "@/lib/storage";
import { guard } from "@/lib/xover-sync";

// GET /api/integrations/x-over/venues/:id/tech-spec — the venue's tech spec file, for x-over to pass on
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(req);
  if (denied) return denied;
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) return NextResponse.json({ error: "No file" }, { status: 404 });
  const venue = await prisma.venue.findUnique({ where: { id: Number(id) }, select: { techSpecFile: true, techSpecFileKey: true, techSpecName: true, techSpecMime: true } });
  const buffer = venue ? await loadFile(venue.techSpecFileKey, venue.techSpecFile) : null;
  if (!venue || !buffer) return NextResponse.json({ error: "No file" }, { status: 404 });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": venue.techSpecMime ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${(venue.techSpecName ?? "tech-spec").replace(/["\r\n]/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
