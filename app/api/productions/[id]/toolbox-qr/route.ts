// The toolbox-talk QR code (staff only). It encodes the show's private toolbox link, not its
// number. ?go=1 opens the form itself instead of the image.
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireProductionAccess } from "@/lib/access";
import { toolboxToken } from "@/lib/toolbox";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProductionAccess(id);
  if ("error" in access) return access.error;
  const { searchParams } = new URL(req.url);
  const stopId = searchParams.get("stopId");
  const token = await toolboxToken(Number(id));
  const baseUrl = process.env.NEXTAUTH_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const url = `${baseUrl}/toolbox-talk/${token}${stopId && /^\d+$/.test(stopId) ? `?stopId=${stopId}` : ""}`;
  if (searchParams.get("go")) return NextResponse.redirect(url);
  const png = await QRCode.toBuffer(url, { type: "png", width: 400, margin: 2 });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}
