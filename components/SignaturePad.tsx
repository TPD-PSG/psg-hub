"use client";

// A finger or mouse signature box. Calls onChange with a PNG data URL, or null when cleared.
import { useRef, useState } from "react";

export default function SignaturePad({ label, onChange, height = 140 }: { label: string; onChange: (png: string | null) => void; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [signed, setSigned] = useState(false);
  const inked = useRef(false); // set during the stroke (state lags a render behind)

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!, r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  };
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = pos(e);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!last.current) return;
    const g = ref.current!.getContext("2d")!, p = pos(e);
    g.strokeStyle = "#111"; g.lineWidth = 2.5; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke();
    last.current = p;
    inked.current = true;
    if (!signed) setSigned(true);
  }
  function up() {
    last.current = null;
    if (inked.current) onChange(ref.current!.toDataURL("image/png"));
  }
  function clear() {
    const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    inked.current = false; setSigned(false); onChange(null);
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline text-xs font-semibold" style={{ color: "var(--tws-muted)" }}>
        <span>{label}</span>
        <button type="button" onClick={clear} className="underline">Clear</button>
      </div>
      <canvas ref={ref} width={560} height={height} aria-label={`${label}: draw a signature`} role="img"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ width: "100%", height, background: "#fff", border: `1px solid ${signed ? "var(--tws-char)" : "var(--tws-line)"}`, touchAction: "none", cursor: "crosshair" }} />
    </div>
  );
}
