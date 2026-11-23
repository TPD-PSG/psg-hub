"use client";

// The app's standard pop-up window (used by the production tabs and Property).
import { useEffect, useId } from "react";

export function Modal({ title, children, onClose, bodyClassName = "px-5 py-4" }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  bodyClassName?: string;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border"
        style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
          <h2 id={titleId} className="font-semibold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>×</button>
        </div>
        <div className={bodyClassName}>{children}</div>
      </div>
    </div>
  );
}
