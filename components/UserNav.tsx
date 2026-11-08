"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export default function UserNav() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!session?.user) return null;

  const initials = session.user.name
    ? session.user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="relative ml-4" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm text-white/75 hover:text-white transition-colors py-5"
      >
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: "var(--psg-blue)" }}>
          {initials}
        </span>
        <span className="hidden md:block">{session.user.name}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-44 rounded-lg shadow-xl border z-50 overflow-hidden"
          style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
            <p className="text-xs font-medium text-white truncate">{session.user.name}</p>
            <p className="text-xs truncate" style={{ color: "var(--psg-muted)" }}>{session.user.email}</p>
          </div>
          {(session.user as any).role === "admin" && (
            <Link href="/settings/users" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">
              Manage Users
            </Link>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/10 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
