"use client";

// The top bar's Help button (28 Nov 2026, as in x-over): opens the guides with the page you were on,
// so the guides for that page come first.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CircleHelp } from "lucide-react";

export default function HelpLink({ color = "currentColor" }: { color?: string }) {
  const pathname = usePathname() ?? "/";
  const search = useSearchParams();
  const from = pathname.startsWith("/help") ? "" : `${pathname}${search?.size ? `?${search}` : ""}`;
  return (
    <Link href={`/help${from ? `?from=${encodeURIComponent(from)}` : ""}`} aria-label="Guides and help" title="Guides and help"
      className="flex items-center justify-center w-9 h-9 opacity-80 hover:opacity-100 transition-opacity" style={{ color }}>
      <CircleHelp size={20} strokeWidth={2} absoluteStrokeWidth aria-hidden="true" />
    </Link>
  );
}
