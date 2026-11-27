import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import "./new-look.css";
import AuthProvider from "@/components/AuthProvider";
import { auth } from "@/auth";
import { DialogHost } from "@/components/Dialogs";
import UserNav from "@/components/UserNav";
import NotificationBell from "@/components/NotificationBell";
import HelpLink from "@/components/HelpLink";
import { MobileSidebarProvider } from "@/components/Sidebar";
import AppChrome from "@/components/AppChrome";
import MobileMenuButton from "@/components/MobileMenuButton";
import SeasonalOverlay from "@/components/SeasonalOverlay";
import { homeSpaceFor, spacesFor, textOn } from "@/lib/spaces";
import { SpaceTopBarLinks } from "@/components/SpaceLinks";
import { newLookFor } from "@/lib/newLook";
import { nlFontVars } from "@/lib/nlFonts";

export const metadata: Metadata = {
  title: "PSG Hub",
  description: "Production Solutions Group — Company Hub",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PSG Hub",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // A person whose company has its own space sees its colours, logo and name in the top bar
  const userId = Number((session?.user as { id?: string } | undefined)?.id);
  const space = userId ? await homeSpaceFor(userId).catch(() => null) : null;
  // Company spaces this person can open get a button in the top bar on every Hub page
  const role = (session?.user as { role?: string } | undefined)?.role ?? "member";
  const spaces = userId ? await spacesFor({ id: userId, role }).catch(() => []) : [];
  const barColor = space?.color ?? "var(--psg-navy)";
  const barInk = space?.color ? textOn(space.color) : "#ffffff";
  // New look (beta): a per-person switch; for now it only switches the new tokens on
  const newLook = userId ? await newLookFor(userId).catch(() => false) : false;
  return (
    <html lang="en" {...(newLook ? { "data-new-look": "", className: nlFontVars } : {})}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0a193d" />
      </head>
      <body className="min-h-screen" style={{ backgroundColor: "var(--psg-dark-bg)", color: "var(--psg-text)" }}>
        <AuthProvider session={session}>
          <MobileSidebarProvider>
            {/* Top bar, sidebar and page (a company space draws its own) */}
            <AppChrome newLook={newLook} spaces={spaces.map(x => ({ slug: x.slug, name: x.name }))} header={
              <header style={{ backgroundColor: barColor }} className="h-14 flex items-center px-4 gap-3 shadow-lg shrink-0 sticky top-0 z-40">
                <MobileMenuButton />
                <Link href="/" className="flex items-center shrink-0 gap-2">
                  {space?.logoUrl ? (
                    <div className="bg-white rounded px-2 py-1 h-10 flex items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API with a cache-busting version */}
                      <img src={space.logoUrl} alt={space.name} className="h-8 w-auto max-w-[90px] object-contain" />
                    </div>
                  ) : (
                    <div className="bg-white rounded px-2 py-1">
                      <Image src="/psg-logo.png" alt="Production Solutions Group" width={70} height={45} className="object-contain" priority />
                    </div>
                  )}
                </Link>
                <span className="text-xs font-semibold tracking-widest uppercase hidden sm:block" style={{ color: barInk, opacity: 0.6 }}>
                  {space ? `${space.shortName ?? space.name} · PSG Hub` : "PSG Hub"}
                </span>
                <div className="flex-1" />
                <SpaceTopBarLinks spaces={spaces} />
                <HelpLink />
                <NotificationBell />
                <UserNav />
              </header>
            }>
              {children}
            </AppChrome>
          </MobileSidebarProvider>
          <SeasonalOverlay />
          <DialogHost />
        </AuthProvider>
      </body>
    </html>
  );
}
