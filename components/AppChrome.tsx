"use client";

// The Hub's own top bar and sidebar, except inside a company space (/spaces/…), which draws its
// own chrome in its brand (app/spaces/[slug]/layout.tsx).
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function AppChrome({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  // Company spaces and the client builds page draw their own chrome in the builder's brand
  if (pathname.startsWith("/spaces/") || pathname === "/my-builds") return <>{children}</>;
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
