// The production's no-login incident form: a private link (random token, so it can't be guessed
// from the production number), its QR code, and making a new one if the old link got out.
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { hsProductionAccess } from "@/lib/incidentRoute";
import { incidentAccess } from "@/lib/incidents";

async function manager(id: string) {
  const access = await hsProductionAccess(id);
  if ("error" in access) return access;
  const { manage } = await incidentAccess(access.userId, access.role, { productionId: Number(id), entityId: null });
  return manage ? access : { error: NextResponse.json({ error: "Only the show's staff and H&S leads can do that" }, { status: 403 }) };
}
const base = (req: NextRequest) => process.env.NEXTAUTH_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await manager(id);
  if ("error" in m) return m.error;
  const p = await prisma.production.findUnique({ where: { id: Number(id) }, select: { hsReportToken: true } });
  if (!p?.hsReportToken) return NextResponse.json({ error: "No form link yet" }, { status: 404 });
  const png = await QRCode.toBuffer(`${base(req)}/report-incident/${p.hsReportToken}`, { type: "png", width: 400, margin: 2 });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}

// { renew: true } replaces the link, so old printed QR codes stop working
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await manager(id);
  if ("error" in m) return m.error;
  const body = await req.json().catch(() => ({}));
  const p = await prisma.production.findUnique({ where: { id: Number(id) }, select: { hsReportToken: true } });
  let token = p?.hsReportToken ?? null;
  if (!token || body.renew) {
    token = randomBytes(12).toString("base64url");
    await prisma.production.update({ where: { id: Number(id) }, data: { hsReportToken: token } });
  }
  return NextResponse.json({ token, url: `${base(req)}/report-incident/${token}` });
}
