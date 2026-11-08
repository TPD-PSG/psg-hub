import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import UserNav from "@/components/UserNav";

export const metadata: Metadata = {
  title: "PSG Hub",
  description: "Production Solutions Group — Company Hub",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ backgroundColor: "var(--psg-dark-bg)", color: "var(--psg-text)" }}>
        <AuthProvider>
        <nav style={{ backgroundColor: "var(--psg-navy)" }} className="text-white px-6 py-0 flex items-center gap-8 shadow-lg">
          <Link href="/" className="flex items-center py-2 shrink-0">
            <div className="bg-white rounded px-2 py-1">
              <Image src="/psg-logo.png" alt="Production Solutions Group" width={80} height={51} className="object-contain" priority />
            </div>
          </Link>
          <div className="h-8 w-px bg-white/20" />
          <span className="text-sm font-semibold tracking-widest uppercase text-white/60 hidden sm:block">
            PSG Hub
          </span>
          <div className="flex-1" />
          <Link href="/" className="text-sm text-white/75 hover:text-white py-5 px-1 border-b-2 border-transparent hover:border-white/50 transition-colors">Dashboard</Link>
          <Link href="/productions" className="text-sm text-white/75 hover:text-white py-5 px-1 border-b-2 border-transparent hover:border-white/50 transition-colors">Productions</Link>
          <Link href="/schedule" className="text-sm text-white/75 hover:text-white py-5 px-1 border-b-2 border-transparent hover:border-white/50 transition-colors">Schedule</Link>
          <Link href="/crew" className="text-sm text-white/75 hover:text-white py-5 px-1 border-b-2 border-transparent hover:border-white/50 transition-colors">Crew</Link>
          <Link href="/hotels" className="text-sm text-white/75 hover:text-white py-5 px-1 border-b-2 border-transparent hover:border-white/50 transition-colors">Hotels</Link>
          <Link href="/haulage" className="text-sm text-white/75 hover:text-white py-5 px-1 border-b-2 border-transparent hover:border-white/50 transition-colors">Haulage</Link>
          <UserNav />
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-8">
          {children}
        </main>
        </AuthProvider>
      </body>
    </html>
  );
}
