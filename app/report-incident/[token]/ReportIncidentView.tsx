"use client";

import { useState } from "react";
import IncidentForm from "@/components/IncidentForm";

export default function ReportIncidentView({ token, info }: { token: string; info: { name: string; venues: string[] } | null }) {
  const [ref, setRef] = useState<string | null>(null);
  const page: React.CSSProperties = { minHeight: "100vh", backgroundColor: "#f8fafc", padding: "24px 16px 48px", color: "#0f172a" };

  if (!info) return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ maxWidth: 380 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>This form isn&apos;t active</h1>
        <p style={{ color: "#64748b" }}>The QR code may be out of date. Tell the production manager or stage manager what happened.</p>
      </div>
    </div>
  );

  if (ref) return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ maxWidth: 380 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Report sent</h1>
        <p style={{ color: "#475569" }}>Thank you. Your reference is <strong>{ref}</strong>. The production team has been told and may be in touch.</p>
        <button type="button" onClick={() => setRef(null)} style={{ marginTop: 16, background: "none", border: "none", color: "#475569", textDecoration: "underline", fontSize: 14, cursor: "pointer" }}>Report something else</button>
      </div>
    </div>
  );

  return (
    <div style={page}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ backgroundColor: "#7f1d1d", borderRadius: 12, padding: "20px 24px", color: "#fff" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8, margin: "0 0 4px" }}>Accident &amp; incident report</p>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{info.name}</h1>
        </div>
        <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 16px", fontSize: 14, color: "#7f1d1d" }}>
          <strong>Emergency? Call 999 first</strong>, then tell the stage manager or production manager. Fill this in once everyone is safe. Near misses count too.
        </div>
        <IncidentForm look="public" venues={info.venues} submitUrl={`/api/report-incident/${token}`} onDone={d => setRef((d as { ref: string }).ref)} />
      </div>
    </div>
  );
}
