// The workshop floor's no-login incident form: a private link, its QR code, and a new one if it got out.
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { spaceBySlug } from "@/lib/spaces";
import { hsSpaceAccess } from "@/lib/incidentRoute";
import { incidentAccess } from "@/lib/incidents";

async function manager(slug: string) {
  const s = await spaceBySlug(slug);
  if (!s) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const access = await hsSpaceAccess(s.id);
  if ("error" in access) return access;
  const { manage } = await incidentAccess(access.userId, access.role, { productionId: null, entityId: s.id });
  return manage ? { s } : { error: NextResponse.json({ error: "Only the workshop's staff and H&S leads can do that" }, { status: 403 }) };
}
const base = (req: NextRequest) => process.env.NEXTAUTH_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const m = await manager((await params).slug);
  if ("error" in m) return m.error;
  const e = await prisma.entity.findUnique({ where: { id: m.s.id }, select: { hsReportToken: true } });
  if (!e?.hsReportToken) return NextResponse.json({ error: "No form link yet" }, { status: 404 });
  const png = await QRCode.toBuffer(`${base(req)}/report-incident/${e.hsReportToken}`, { type: "png", width: 400, margin: 2 });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const m = await manager((await params).slug);
  if ("error" in m) return m.error;
  const body = await req.json().catch(() => ({}));
  const e = await prisma.entity.findUnique({ where: { id: m.s.id }, select: { hsReportToken: true } });
  let token = e?.hsReportToken ?? null;
  if (!token || body.renew) {
    token = randomBytes(12).toString("base64url");
    await prisma.entity.update({ where: { id: m.s.id }, data: { hsReportToken: token } });
  }
  return NextResponse.json({ token, url: `${base(req)}/report-incident/${token}` });
}
