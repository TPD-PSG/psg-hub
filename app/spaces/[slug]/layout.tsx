// A company space's own chrome (TWS mockups, 25 Nov 2026): its top bar, sidebar, type and colours.
// The rest of the Hub stays one click away under "Shared with PSG".
import type { Metadata } from "next";
import { Montserrat, Josefin_Sans } from "next/font/google";
import { auth } from "@/auth";
import { spaceBySlug, canSeeSpace } from "@/lib/spaces";
import { spaceTokens } from "@/lib/spaceTheme";
import SpaceShell from "@/components/SpaceShell";

const body = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--tws-font", display: "swap" });
const capsFace = Josefin_Sans({ subsets: ["latin"], weight: ["700"], variable: "--tws-caps-font", display: "swap" });

// Inside a space the browser tab shows the company's logo and short name (e.g. "TWS")
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const space = /^[a-z0-9-]{2,30}$/.test(slug) ? await spaceBySlug(slug).catch(() => null) : null;
  if (!space) return {};
  const name = (space.shortName ?? space.name).toUpperCase();
  return {
    title: `${name} · PSG Hub`,
    // Square icon made from the logo (or a lettermark); ?v= changes when the logo does
    icons: {
      icon: [{ url: `/api/spaces/${space.slug}/icon?s=64&v=${encodeURIComponent(space.logoUrl ?? "none")}`, type: "image/png", sizes: "64x64" }],
      apple: [{ url: `/api/spaces/${space.slug}/icon?s=180&v=${encodeURIComponent(space.logoUrl ?? "none")}`, sizes: "180x180" }],
    },
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: name },
  };
}

export default async function SpaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; name?: string } | undefined;
  const space = /^[a-z0-9-]{2,30}$/.test(slug) ? await spaceBySlug(slug).catch(() => null) : null;
  const allowed = space && user?.id ? await canSeeSpace({ id: Number(user.id), role: user.role ?? "member" }, space.id) : false;
  if (!space || !allowed) return <>{children}</>;
  return (
    <div className={`${body.variable} ${capsFace.variable}`} style={{ ...spaceTokens(space.color), fontFamily: "var(--tws-font), system-ui, sans-serif" } as React.CSSProperties}>
      <SpaceShell space={space} staff={user?.role === "admin" || user?.role === "member"}>{children}</SpaceShell>
    </div>
  );
}
