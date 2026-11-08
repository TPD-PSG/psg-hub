"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ExportMenu from "@/components/ExportMenu";
import { exportHaulagePDF, exportHaulageXLSX } from "@/lib/exports";

type Movement = {
  id: number;
  productionId: number;
  production: { id: number; name: string };
  haulageCompany: string;
  driverName: string | null;
  vehicleInfo: string | null;
  fromLocation: string;
  toLocation: string;
  departureAt: string;
  arrivalAt: string | null;
  cargo: string | null;
  notes: string | null;
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function HaulagePage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/haulage").then((r) => r.json()).then(setMovements);
  }, []);

  const filtered = movements.filter((m) => {
    const q = search.toLowerCase();
    return !q || m.haulageCompany.toLowerCase().includes(q) || m.fromLocation.toLowerCase().includes(q) || m.toLocation.toLowerCase().includes(q) || (m.cargo ?? "").toLowerCase().includes(q) || m.production.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Haulage</h1>
        <ExportMenu actions={[
          { label: "Export PDF", onClick: () => exportHaulagePDF("All Productions", filtered, true) },
          { label: "Export Excel", onClick: () => exportHaulageXLSX("All Productions", filtered, true) },
        ]} />
      </div>

      <div>
        <input
          className="w-full max-w-sm rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500"
          style={{ backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" }}
          placeholder="Search by company, location, cargo, production…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-16" style={{ color: "var(--psg-muted)" }}>
          {movements.length === 0 ? "No haulage movements recorded yet. Add them from a production." : "No movements match your search."}
        </p>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                <th className="px-4 py-3 text-left font-medium text-white">Production</th>
                <th className="px-4 py-3 text-left font-medium text-white">Company</th>
                <th className="px-4 py-3 text-left font-medium text-white">From</th>
                <th className="px-4 py-3 text-left font-medium text-white">To</th>
                <th className="px-4 py-3 text-left font-medium text-white">Departure</th>
                <th className="px-4 py-3 text-left font-medium text-white">Arrival</th>
                <th className="px-4 py-3 text-left font-medium text-white">Driver / Vehicle</th>
                <th className="px-4 py-3 text-left font-medium text-white">Cargo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-t hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)" }}>
                  <td className="px-4 py-3">
                    <Link href={`/productions/${m.productionId}`} className="text-blue-400 hover:text-blue-300 font-medium">{m.production.name}</Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{m.haulageCompany}</td>
                  <td className="px-4 py-3 text-white">{m.fromLocation}</td>
                  <td className="px-4 py-3 text-white">{m.toLocation}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>
                    <div>{fmtDate(m.departureAt)}</div>
                    <div className="text-xs">{fmtTime(m.departureAt)}</div>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>
                    {m.arrivalAt ? (
                      <>
                        <div>{fmtDate(m.arrivalAt)}</div>
                        <div className="text-xs">{fmtTime(m.arrivalAt)}</div>
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                    {m.driverName && <div>{m.driverName}</div>}
                    {m.vehicleInfo && <div>{m.vehicleInfo}</div>}
                    {!m.driverName && !m.vehicleInfo && "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{m.cargo || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
