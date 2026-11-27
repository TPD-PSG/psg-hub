"use client";

// Keyboard behaviour for pop-up windows (audit round 2): focus moves into the window when it opens,
// Tab and Shift+Tab stay inside it, Escape closes it, and focus goes back to whatever opened it.
import { useEffect, useRef, useState, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogFocus(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  // Who opened it, noted while rendering: an autoFocus field inside takes focus before effects run
  const [opener] = useState(() => (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)));
  useEffect(() => {
    const box = ref.current;
    const items = () => (box ? Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement) : []);
    // Prefer the first form field (else the first control) so typing can start straight away
    const first = box?.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), select, textarea") ?? items()[0];
    (first ?? box)?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Another dialog opened on top (e.g. "Are you sure?") handles its own keys
      const active = document.activeElement;
      const otherDialog = active?.closest('[role="dialog"], [role="alertdialog"]');
      if (otherDialog && box && otherDialog !== box && !box.contains(otherDialog)) return;
      if (e.key === "Escape") { e.stopPropagation(); close.current(); return; }
      if (e.key !== "Tab" || !box) return;
      const list = items();
      if (!list.length) { e.preventDefault(); return; }
      const [a, z] = [list[0], list[list.length - 1]];
      if (e.shiftKey && (document.activeElement === a || !box.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (document.activeElement === z || !box.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); if (opener && document.contains(opener)) opener.focus(); };
  }, [ref, opener]);
}
