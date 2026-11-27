"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";

export default function UserNav() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  // New look (beta): per person, off by default; switching reloads so the whole page follows
  const [newLook, setNewLook] = useState<boolean | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the page after it shows (the server sets the attribute)
  useEffect(() => { setNewLook(document.documentElement.hasAttribute("data-new-look")); }, []);
  async function toggleNewLook() {
    const on = !newLook;
    const res = await fetch("/api/me/new-look", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on }) });
    if (res.ok) window.location.reload();
  }
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
        <span className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0 relative" style={{ backgroundColor: "var(--psg-blue)" }}>
          {(session.user as { avatarUrl?: string | null; role?: string }).avatarUrl ? (
            <Image src={(session.user as { avatarUrl: string }).avatarUrl} alt={session.user.name ?? ""} fill className="object-cover" />
          ) : initials}
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
          <Link href="/profile" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">
            My Profile
          </Link>
          <Link href="/my-offers" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">
            My crew offers
          </Link>
          {newLook !== null && (
            <button type="button" role="switch" aria-checked={newLook} onClick={toggleNewLook}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">
              <span>New look (beta)</span>
              <span aria-hidden="true" className="w-8 h-4 rounded-full relative shrink-0" style={{ backgroundColor: newLook ? "#5b8def" : "rgba(255,255,255,0.2)" }}>
                <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: newLook ? 18 : 2 }} />
              </span>
            </button>
          )}
          {(session.user as { avatarUrl?: string | null; role?: string }).role === "admin" && (
            <Link href="/admin/users" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">
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
