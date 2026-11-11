"use client";

import { useMobileSidebar } from "@/components/Sidebar";

export default function MobileMenuButton() {
  const { setOpen } = useMobileSidebar();
  return (
    <button
      className="md:hidden flex flex-col justify-center items-center w-9 h-9 gap-1.5 rounded hover:bg-white/10 transition-colors shrink-0"
      onClick={() => setOpen(true)}
      aria-label="Open menu"
    >
      <span className="w-5 h-0.5 bg-white/70 rounded" />
      <span className="w-5 h-0.5 bg-white/70 rounded" />
      <span className="w-5 h-0.5 bg-white/70 rounded" />
    </button>
  );
}
