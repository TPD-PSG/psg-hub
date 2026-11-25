// A drawing file for the client whose build it's on
import { prisma } from "@/lib/prisma";
import { loadFile } from "@/lib/storage";
import { clientViewer } from "@/lib/clientPortal";

export async function GET(_req: Request, { params }: { params: Promise<{ revisionId: string }> }) {
  const v = await clientViewer();
  if ("error" in v) return v.error;
  const r = await prisma.drawingRevision.findFirst({
    where: { id: parseInt((await params).revisionId) || 0, drawing: { job: { clientId: v.clientId, status: { not: "cancelled" } } } },
    select: { file: { select: { name: true, mime: true, fileKey: true, data: true } } },
  });
  if (!r) return new Response("Not found", { status: 404 });
  const bytes = await loadFile(r.file.fileKey, r.file.data).catch(() => null);
  if (!bytes) return new Response("Not found", { status: 404 });
  const name = r.file.name.replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": r.file.mime, "Content-Disposition": `inline; filename="${name}"`, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
