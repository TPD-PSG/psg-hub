// A drawing or design file on a build you have a part on. Drawings: only the current revision.
import { prisma } from "@/lib/prisma";
import { fileHeaders } from "@/lib/fileHeaders";
import { loadFile } from "@/lib/storage";
import { myJob, myWorkViewer } from "@/lib/myWork";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; fileId: string }> }) {
  const { slug, fileId } = await params;
  const v = await myWorkViewer(slug);
  if ("error" in v) return new Response("Not found", { status: 404 });
  const f = await prisma.jobFile.findUnique({
    where: { id: Number(fileId) || 0 },
    select: { jobId: true, kind: true, name: true, mime: true, fileKey: true, data: true, revision: { select: { status: true } } },
  });
  // Design and model-box files, and drawings that aren't superseded; never certificates or repair photos
  const allowed = f && (f.revision ? f.revision.status !== "superseded" : ["design", "modelbox"].includes(f.kind));
  if (!f || !allowed || "error" in (await myJob(v, f.jobId))) return new Response("Not found", { status: 404 });
  const bytes = await loadFile(f.fileKey, f.data).catch(() => null);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: fileHeaders(f.mime, f.name.replace(/[^\w.\- ]+/g, "_"), { "Cache-Control": "private, max-age=3600" }) });
}
