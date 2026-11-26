// A company space's logo, for anyone signed in (it appears in the top bar)
import { prisma } from "@/lib/prisma";
import { fileHeaders } from "@/lib/fileHeaders";
import { auth } from "@/auth";
import { loadFile } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await auth())) return new Response("Unauthorized", { status: 401 });
  const e = await prisma.entity.findUnique({ where: { slug: (await params).slug }, select: { logoKey: true, logoData: true, logoMime: true } });
  if (!e?.logoMime) return new Response("Not found", { status: 404 });
  const bytes = await loadFile(e.logoKey, e.logoData).catch(() => null);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: fileHeaders(e.logoMime, "logo", { "Cache-Control": "private, max-age=86400" }),
  });
}
