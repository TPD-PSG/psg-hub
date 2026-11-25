// The client builds page wears the builder's brand (e.g. TWS): its type here, its colours and logo
// in ClientShell. Clients get no Hub menu, just their builds.
import type { Metadata } from "next";
import { Montserrat, Josefin_Sans } from "next/font/google";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clientBrand } from "@/lib/clientPortal";

const body = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--tws-font", display: "swap" });
const capsFace = Josefin_Sans({ subsets: ["latin"], weight: ["700"], variable: "--tws-caps-font", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const id = Number(((await auth())?.user as { id?: string } | undefined)?.id);
  const u = id ? await prisma.user.findUnique({ where: { id }, select: { clientId: true } }) : null;
  const brand = u?.clientId ? await clientBrand(u.clientId).catch(() => null) : null;
  if (!brand) return { title: "Your builds · PSG Hub" };
  const name = (brand.shortName ?? brand.name).toUpperCase();
  const v = encodeURIComponent(brand.logoUrl ?? "none");
  return {
    title: `Your builds · ${name}`,
    icons: { icon: [{ url: `/api/spaces/${brand.slug}/icon?s=64&v=${v}`, type: "image/png", sizes: "64x64" }], apple: [{ url: `/api/spaces/${brand.slug}/icon?s=180&v=${v}`, sizes: "180x180" }] },
  };
}

export default function MyBuildsLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${body.variable} ${capsFace.variable}`}>{children}</div>;
}
