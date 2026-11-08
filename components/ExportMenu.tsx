"use client";

import { useState, useRef, useEffect } from "react";

type ExportAction = { label: string; onClick: () => void };

export default function ExportMenu({ actions }: { actions: ExportAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="border px-3 py-2 rounded text-sm hover:bg-white/5 transition-colors text-white flex items-center gap-1.5"
        style={{ borderColor: "var(--psg-card-border)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 w-44 rounded-lg shadow-xl border z-50 overflow-hidden"
          style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}
        >
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => { a.onClick(); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
