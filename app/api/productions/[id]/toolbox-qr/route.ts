import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const stopId = searchParams.get("stopId");
  const baseUrl = process.env.NEXTAUTH_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const url = stopId
    ? `${baseUrl}/toolbox-talk/${id}?stopId=${stopId}`
    : `${baseUrl}/toolbox-talk/${id}`;
  const png = await QRCode.toBuffer(url, { type: "png", width: 400, margin: 2 });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}
