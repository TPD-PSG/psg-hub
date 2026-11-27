"use client";

// The Hub's own top bar and sidebar, except inside a company space (/spaces/…), which draws its
// own chrome in its brand (app/spaces/[slug]/layout.tsx).
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NewShell, { type ShellSpace } from "@/components/NewShell";

export default function AppChrome({ header, children, newLook = false, spaces = [] }: { header: React.ReactNode; children: React.ReactNode; newLook?: boolean; spaces?: ShellSpace[] }) {
  const pathname = usePathname() ?? "";
  // Company spaces and the client builds page draw their own chrome in the builder's brand; the
  // no-login incident form (QR on site) and crew offer links are pages of their own
  if (pathname.startsWith("/spaces/") || pathname === "/my-builds" || pathname === "/my-hires" || pathname.startsWith("/report-incident/") || pathname.startsWith("/crew-offer/")) return <>{children}</>;
  // New look (beta): its own sidebar shell (same routes and pages)
  if (newLook && pathname !== "/login") return <NewShell spaces={spaces}>{children}</NewShell>;
  return (
    <>
      {header}
      <div className="flex" style={{ minHeight: "calc(100vh - 56px)" }}>
        <Sidebar />
        <main className="flex-1 min-w-0 px-4 md:px-6 py-6 md:py-8">{children}</main>
      </div>
    </>
  );
}
