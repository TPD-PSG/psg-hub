// Shared types and small helpers for the space build job page (SpaceJob and its panels).
import type { JobDetail } from "@/app/jobs/[id]/JobView";
import type { PartMaterial } from "@/components/PartMaterials";

export type PartRow = { id: number; jobId: number; label: string; userId: number | null; startDate: string | null; days: number; hours: number | null; done: boolean; pencilled?: boolean; materials?: PartMaterial[]; labourTypeId?: number | null; labourType?: { id: number; name: string; dayRate: number | null } | null; user: { id: number; name: string } | null };
export type Option = { id: number; name: string };
export type JobPhoto = { id: number; url: string; caption: string | null; postId: number | null; clientVisible?: boolean; createdAt: string; uploadedById: number | null; uploadedBy: { name: string } | null };
export type JobMaterials = {
  pos: { id: number; number: string; status: string; inSage: boolean; total: number; supplierName: string | null; supplier: { name: string } | null; lines: { id: number; description: string; quantity: number; unit: string | null; unitCost: number }[] }[];
  moves: { id: number; change: number; kind: string; createdAt: string; item: { name: string; unit: string } }[];
  items: { id: number; name: string; unit: string; quantity: number }[];
};
export type Me = { id: number; isAdmin: boolean };
// The page's shared JSON call (sets busy, shows the error, returns the data or null)
export type Call = (url: string, method: string, body?: unknown) => Promise<{ job?: JobDetail } | null>;

export const gbp = (n: number | null | undefined) => (n == null ? "–" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n));
export const ymd = (s: string | null) => (s ? s.slice(0, 10) : "");
export const today = () => new Date().toISOString().slice(0, 10);
export const when = (p: PartRow) => {
  if (!p.startDate) return "Not planned";
  const s = new Date(p.startDate), e = new Date(s.getTime() + (p.days - 1) * 86400e3);
  const f = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return p.days === 1 ? f(s) : `${f(s)} – ${f(e)}`;
};
export const th = "text-left font-semibold py-2 pr-3";
export const td = "py-2 pr-3 align-top";
