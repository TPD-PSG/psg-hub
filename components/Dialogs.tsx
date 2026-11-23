"use client";

// In-app replacements for the browser's confirm() and alert(), which some views (embedded,
// installed app, some mobile browsers) block or show without the app's styling.
//   if (!(await confirmDialog("Delete this note?"))) return;
//   alertDialog("Couldn't save");
// <DialogHost /> is mounted once in the root layout.
import { useEffect, useRef, useState } from "react";

type Request = {
  kind: "confirm" | "alert";
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
};

let show: ((r: Request) => void) | null = null;
const pending: Request[] = [];

function open(r: Omit<Request, "resolve">): Promise<boolean> {
  return new Promise(resolve => {
    const req = { ...r, resolve };
    if (show) show(req);
    else pending.push(req);
  });
}

const DESTRUCTIVE = /^(delete|remove|permanently|archive)\b/i;

export function confirmDialog(message: string, opts: { confirmLabel?: string; cancelLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  const verb = message.match(DESTRUCTIVE)?.[1];
  return open({
    kind: "confirm",
    message,
    confirmLabel: opts.confirmLabel ?? (verb ? verb[0].toUpperCase() + verb.slice(1).toLowerCase() : "OK"),
    cancelLabel: opts.cancelLabel ?? "Cancel",
    danger: opts.danger ?? !!verb,
  });
}

export function alertDialog(message: string): Promise<void> {
  return open({ kind: "alert", message, confirmLabel: "OK", cancelLabel: "", danger: false }).then(() => undefined);
}

export function DialogHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const current = queue[0];

  useEffect(() => {
    show = r => setQueue(q => [...q, r]);
    if (pending.length) setQueue(q => [...q, ...pending.splice(0)]);
    return () => { show = null; };
  }, []);

  useEffect(() => { if (current) confirmRef.current?.focus(); }, [current]);

  if (!current) return null;
  const close = (ok: boolean) => { current.resolve(ok); setQueue(q => q.slice(1)); };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) close(false); }}
      // stopPropagation: Escape cancels only this dialog, not a Modal underneath it
      onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); close(false); } }}
    >
      <div
        role={current.kind === "confirm" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-describedby="psg-dialog-message"
        className="w-full max-w-sm rounded-xl border p-5 space-y-4 shadow-2xl"
        style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}
      >
        <p id="psg-dialog-message" className="text-sm text-white whitespace-pre-line">{current.message}</p>
        <div className="flex justify-end gap-2">
          {current.kind === "confirm" && (
            <button type="button" onClick={() => close(false)}
              className="px-4 py-2 rounded text-sm border hover:bg-white/5 transition-colors"
              style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
              {current.cancelLabel}
            </button>
          )}
          <button ref={confirmRef} type="button" onClick={() => close(true)}
            className="px-4 py-2 rounded text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: current.danger ? "#dc2626" : "var(--psg-blue)" }}>
            {current.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
