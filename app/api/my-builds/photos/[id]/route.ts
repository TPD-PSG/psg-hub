// A progress photo for the client whose build it's on (only photos staff ticked "Client")
import { prisma } from "@/lib/prisma";
import { fileHeaders } from "@/lib/fileHeaders";
import { loadFile } from "@/lib/storage";
import { clientViewer } from "@/lib/clientPortal";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await clientViewer();
  if ("error" in v) return v.error;
  const p = await prisma.spacePhoto.findFirst({
    where: { id: parseInt((await params).id) || 0, clientVisible: true, job: { clientId: v.clientId, status: { not: "cancelled" } } },
    select: { mime: true, fileKey: true, data: true },
  });
  if (!p) return new Response("Not found", { status: 404 });
  const bytes = await loadFile(p.fileKey, p.data).catch(() => null);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: fileHeaders(p.mime, "photo", { "Cache-Control": "private, max-age=3600" }) });
}
