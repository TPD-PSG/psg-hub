// Plain helpers and types for the rentals pages, usable on the server and in the browser.
import type { SpaceTheme } from "@/lib/spaces";

export type Product = {
  id: number; name: string; category: string | null; manufacturer: string | null; model: string | null;
  dayRate: number | null; weekRate: number | null; replacementCost: number | null; weightKg: number | null; powerW: number | null;
  isCase: boolean; notes: string | null; archived: boolean;
  units: { total: number; available: number; repair: number; lost: number; retired: number }; outToday: number;
};
export type Pkg = { id: number; name: string; description: string | null; items: { productId: number; quantity: number; product: { id: number; name: string } }[] };
export type HireRow = {
  id: number; number: string; title: string; clientName: string | null; clientEmail: string | null; status: string;
  outDate: string; returnDate: string; notes: string | null; items: number; productionId: number | null; production: { id: number; name: string } | null;
  net?: number; invoice?: { id: number; status: string } | null; clientId?: number | null; requestedAt?: string | null; acceptedAt?: string | null; acceptedBy?: string | null;
};
export type RentalsData = { space: SpaceTheme; isAdmin: boolean; products: Product[]; packages: Pkg[]; hires: HireRow[]; productions: { id: number; name: string }[]; clients?: { id: number; name: string; billingEmail: string | null }[] };

export const gbp = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n));
export const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const todayIso = () => { const d = new Date(); return isoDay(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))); };
export const addDays = (iso: string, n: number) => isoDay(new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86_400_000));

export const HIRE_TONE: Record<string, React.CSSProperties> = {
  quote: { background: "transparent", color: "var(--tws-ink)", border: "1px dashed var(--tws-muted)" },
  confirmed: { background: "var(--tws-accent)", color: "var(--tws-ink)" },
  out: { background: "var(--tws-char)", color: "#fff" },
  returned: { background: "var(--tws-tint)", color: "#4e545b" },
  cancelled: { background: "transparent", color: "var(--tws-muted)", textDecoration: "line-through", border: "1px solid var(--tws-line)" },
};
export const HIRE_LABEL: Record<string, string> = { quote: "Quote (pencilled)", confirmed: "Confirmed", out: "Out", returned: "Returned", cancelled: "Cancelled" };

