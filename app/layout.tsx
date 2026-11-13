import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import UserNav from "@/components/UserNav";
import NotificationBell from "@/components/NotificationBell";
import Sidebar, { MobileSidebarProvider } from "@/components/Sidebar";
import MobileMenuButton from "@/components/MobileMenuButton";
import SeasonalOverlay from "@/components/SeasonalOverlay";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0a193d" />
      </head>
      <body className="min-h-screen" style={{ backgroundColor: "var(--psg-dark-bg)", color: "var(--psg-text)" }}>
        <AuthProvider>
          <MobileSidebarProvider>
            {/* Top bar */}
            <header style={{ backgroundColor: "var(--psg-navy)" }} className="h-14 flex items-center px-4 gap-3 shadow-lg shrink-0 sticky top-0 z-40">
              <MobileMenuButton />
              <Link href="/" className="flex items-center shrink-0">
                <div className="bg-white rounded px-2 py-1">
                  <Image src="/psg-logo.png" alt="Production Solutions Group" width={70} height={45} className="object-contain" priority />
                </div>
              </Link>
              <span className="text-xs font-semibold tracking-widest uppercase text-white/40 hidden sm:block">PSG Hub</span>
              <div className="flex-1" />
              <NotificationBell />
              <UserNav />
            </header>

            {/* Body: sidebar + content */}
            <div className="flex" style={{ minHeight: "calc(100vh - 56px)" }}>
              <Sidebar />
              <main className="flex-1 min-w-0 px-4 md:px-6 py-6 md:py-8">
                {children}
              </main>
            </div>
          </MobileSidebarProvider>
          <SeasonalOverlay />
        </AuthProvider>
      </body>
    </html>
  );
}
