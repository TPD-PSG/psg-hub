// Flame-retardant certificates on a build (27 Nov 2026). Standards offered as suggestions; any
// text is accepted. A certificate past its expiry date is flagged.
import { prisma } from "@/lib/prisma";
import { fileUrl } from "@/lib/jobDesign";

export { FR_STANDARDS } from "@/lib/frCertsShared";
export const CERT_KINDS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export async function certsFor(jobId: number) {
  const rows = await prisma.frCertificate.findMany({
    where: { jobId }, orderBy: { createdAt: "asc" },
    select: { id: true, title: true, standard: true, supplier: true, issuedAt: true, expiresAt: true, createdAt: true, file: { select: { id: true, name: true, mime: true } } },
  });
  const now = Date.now();
  return rows.map(c => ({ ...c, url: fileUrl(c.file.id), expired: !!c.expiresAt && c.expiresAt.getTime() < now }));
}
