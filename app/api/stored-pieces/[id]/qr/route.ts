// The QR code on a piece's label: opens the piece's page in its company space.
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { memberOfEntity } from "@/lib/spaceBoard";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())) return new Response("Unauthorized", { status: 401 });
  const piece = await prisma.storedPiece.findUnique({ where: { id: parseInt((await params).id) || 0 }, select: { id: true, entityId: true, entity: { select: { slug: true } } } });
  if (!piece?.entity.slug) return new Response("Not found", { status: 404 });
  const m = await memberOfEntity(piece.entityId); // only people who can open that workshop's space
  if ("error" in m) return m.error;
  const u = new URL(req.url);
  const base = process.env.NEXTAUTH_URL || `${u.protocol}//${u.host}`;
  const png = await QRCode.toBuffer(`${base}/spaces/${piece.entity.slug}/pieces/${piece.id}`, { type: "png", width: 360, margin: 1 });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" } });
}
