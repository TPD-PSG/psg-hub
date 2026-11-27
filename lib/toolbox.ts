// The toolbox-talk sign-off form is public (a QR code on site), so which show a link opens is
// decided here (live security check, 27 Nov 2026). New links use a private random token, so show
// names and tours can't be listed by trying numbers. Old numeric links, already printed at venues,
// keep working only while the show is in production and not under NDA.
import { randomBytes } from "crypto";
import { prisma } from "./prisma";

/** The production a toolbox link opens, or null when the link isn't (or is no longer) active. */
export async function toolboxTarget(key: string): Promise<number | null> {
  if (/^\d+$/.test(key)) {
    const p = await prisma.production.findUnique({ where: { id: Number(key) }, select: { id: true, status: true, archived: true, announcementStatus: true } });
    return p && !p.archived && p.status === "in-production" && p.announcementStatus !== "nda" ? p.id : null;
  }
  if (!/^[A-Za-z0-9_-]{12,40}$/.test(key)) return null;
  const p = await prisma.production.findUnique({ where: { toolboxToken: key }, select: { id: true, archived: true } });
  return p && !p.archived ? p.id : null;
}

/** The production's private toolbox token, made the first time it's needed. */
export async function toolboxToken(productionId: number): Promise<string> {
  const p = await prisma.production.findUnique({ where: { id: productionId }, select: { toolboxToken: true } });
  if (p?.toolboxToken) return p.toolboxToken;
  const token = randomBytes(12).toString("base64url");
  await prisma.production.update({ where: { id: productionId }, data: { toolboxToken: token } });
  return token;
}
