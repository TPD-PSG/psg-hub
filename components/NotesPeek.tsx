"use client";

// A small notes icon that shows the notes in a pop-up: on hover with a mouse, on tap on a phone or
// tablet (Tom's roadmap idea, 24 Nov: see a budget line's notes without opening Edit).
import { useEffect, useRef, useState } from "react";

export default function NotesPeek({ notes, label = "Notes" }: { notes: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false); // opened by a click/tap: stays until clicked away
  const ref = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  // Placed on the page itself (fixed), so a card's edge never clips it; below the icon, or above
  // it when there's no room underneath
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number }>({ left: 0, top: 0 });
  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const w = Math.min(288, window.innerWidth * 0.8);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    setPos(window.innerHeight - r.bottom < 180 ? { left, bottom: window.innerHeight - r.top + 4 } : { left, top: r.bottom + 4 });
  };
  const show = () => { place(); setOpen(true); };
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setPinned(false); } };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setPinned(false); } };
    const scrolled = () => place(); // follow the icon as the page scrolls
    document.addEventListener("mousedown", away); document.addEventListener("touchstart", away); document.addEventListener("keydown", esc);
    window.addEventListener("scroll", scrolled, true);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); document.removeEventListener("keydown", esc); window.removeEventListener("scroll", scrolled, true); };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex shrink-0" onMouseEnter={show} onMouseLeave={() => { if (!pinned) setOpen(false); }}>
      <button ref={btn} type="button" aria-label={`${label}: show`} aria-expanded={open}
        onClick={e => { e.stopPropagation(); if (open && pinned) { setOpen(false); setPinned(false); } else { setPinned(true); show(); } }}
        className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-white/10" style={{ color: "#fbbf24" }}>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2.5h7l3 3v8H3z" /><path d="M10 2.5v3h3M5.5 8h5M5.5 10.5h5" /></svg>
      </button>
      {open && (
        <span role="tooltip" onClick={e => e.stopPropagation()}
          className="fixed z-50 w-72 max-w-[80vw] max-h-[50vh] overflow-y-auto rounded-lg border p-3 text-xs leading-relaxed whitespace-pre-wrap shadow-xl cursor-text select-text"
          style={{ ...pos, backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)", color: "var(--psg-text)" }}>
          <span className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--psg-muted)" }}>{label}</span>
          {notes}
        </span>
      )}
    </span>
  );
}
