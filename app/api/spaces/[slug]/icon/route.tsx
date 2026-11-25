// A company space's browser-tab icon: its logo fitted into a square (a wide logo like TWS's
// would be squashed otherwise), or its short name on its colour if there's no logo yet.
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { loadFile } from "@/lib/storage";
import { spaceTokens } from "@/lib/spaceTheme";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await auth())) return new Response("Unauthorized", { status: 401 });
  const e = await prisma.entity.findUnique({ where: { slug: (await params).slug }, select: { name: true, shortName: true, color: true, logoKey: true, logoData: true, logoMime: true, hasSpace: true } });
  if (!e?.hasSpace) return new Response("Not found", { status: 404 });
  const size = Math.min(512, Math.max(16, Number(new URL(req.url).searchParams.get("s")) || 64));
  const tokens = spaceTokens(e.color);
  // The image renderer reads PNG and JPEG; other logos (WebP) fall back to the lettermark
  const bytes = e.logoMime && /png|jpe?g/.test(e.logoMime) ? await loadFile(e.logoKey, e.logoData).catch(() => null) : null;
  const pad = Math.round(size * 0.06);
  return new ImageResponse(
    bytes ? (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", padding: pad }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG on the server */}
        <img src={`data:${e.logoMime};base64,${Buffer.from(bytes).toString("base64")}`} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
    ) : (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: tokens["--tws-night"], color: tokens["--tws-accent"], fontSize: size * 0.36, fontWeight: 800, borderBottom: `${Math.max(2, size / 12)}px solid ${tokens["--tws-accent"]}` }}>
        {(e.shortName ?? e.name).slice(0, 3).toUpperCase()}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "private, max-age=86400" } },
  );
}
