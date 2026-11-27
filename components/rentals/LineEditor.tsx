"use client";
// Product lines with quantities, for packages and hires. Shows what's free when `free` is given.
import { input } from "@/lib/twsUi";
import type { Product, Pkg } from "./format";

export type EditLine = { productId: number; quantity: number; dayRate?: number | null; note?: string | null };

export default function LineEditor({ products, packages, lines, onChange, free, label = "Kit" }: {
  products: Product[]; packages?: Pkg[]; lines: EditLine[]; onChange: (l: EditLine[]) => void;
  free?: Map<number, number> | null; label?: string;
}) {
  const name = (id: number) => products.find(p => p.id === id)?.name ?? "Product";
  const need = new Map<number, number>();
  for (const l of lines) need.set(l.productId, (need.get(l.productId) ?? 0) + l.quantity);
  const add = (productId: number, quantity = 1) => {
    const i = lines.findIndex(l => l.productId === productId);
    onChange(i >= 0 ? lines.map((l, j) => (j === i ? { ...l, quantity: l.quantity + quantity } : l)) : [...lines, { productId, quantity }]);
  };
  const addPackage = (id: number) => {
    const p = packages?.find(x => x.id === id);
    if (!p) return;
    let next = [...lines];
    for (const it of p.items) {
      const i = next.findIndex(l => l.productId === it.productId);
      next = i >= 0 ? next.map((l, j) => (j === i ? { ...l, quantity: l.quantity + it.quantity } : l)) : [...next, { productId: it.productId, quantity: it.quantity }];
    }
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{label}</span>
      {lines.length === 0 && <p className="text-sm" style={{ color: "var(--tws-muted)" }}>Nothing added yet.</p>}
      {lines.map((l, i) => {
        const f = free?.get(l.productId);
        const short = f != null && (need.get(l.productId) ?? 0) > f;
        return (
          <div key={`${l.productId}-${i}`} className="flex items-center gap-2 flex-wrap">
            <input aria-label={`Quantity of ${name(l.productId)}`} style={{ ...input, width: 70 }} inputMode="numeric" value={l.quantity}
              onChange={e => { const n = parseInt(e.target.value) || 0; onChange(lines.map((x, j) => (j === i ? { ...x, quantity: Math.max(0, Math.min(10_000, n)) } : x))); }} />
            <span className="flex-1 min-w-[140px] text-sm font-semibold">{name(l.productId)}</span>
            {f != null && <span className="text-xs font-bold px-2 py-1" style={short ? { background: "var(--tws-bad-bg, #fde8e8)", color: "var(--tws-bad-ink)" } : { background: "var(--tws-tint)", color: "var(--tws-ink)" }}>
              {short ? `Short: ${Math.max(0, f)} free` : `${f} free`}</span>}
            <button type="button" aria-label={`Remove ${name(l.productId)}`} onClick={() => onChange(lines.filter((_, j) => j !== i))} className="text-xs font-semibold px-1" style={{ color: "var(--tws-bad-ink)" }}>Remove</button>
          </div>
        );
      })}
      <div className="flex gap-2 flex-wrap">
        <select aria-label="Add a product" style={{ ...input, width: "auto", flex: 1, minWidth: 180 }} value="" onChange={e => e.target.value && add(Number(e.target.value))}>
          <option value="">+ Add a product…</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.category ? ` (${p.category})` : ""}</option>)}
        </select>
        {packages && packages.length > 0 && (
          <select aria-label="Add a package" style={{ ...input, width: "auto", flex: 1, minWidth: 160 }} value="" onChange={e => e.target.value && addPackage(Number(e.target.value))}>
            <option value="">+ Add a package…</option>
            {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
