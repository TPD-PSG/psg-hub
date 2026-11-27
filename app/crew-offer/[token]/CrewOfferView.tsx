"use client";

// What a crew member sees from their offer link: the job, the day and times, where, their pay,
// and two big buttons. Made for a phone, with no login and no Hub menus.
import { useState } from "react";

export type OfferView = {
  name: string; status: string; reply: string | null; canAnswer: boolean; message: string;
  job: { role: string; for: string | null; date: string; time: string | null; location: string | null; notes: string | null; pay: string | null; company: string; phone: string | null };
};

const page: React.CSSProperties = { minHeight: "100vh", background: "#f4f5f7", color: "#1a1d21", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", padding: "24px max(16px, env(safe-area-inset-left, 0px))" };
const cardS: React.CSSProperties = { background: "#fff", border: "1px solid #dfe2e7", borderRadius: 12, padding: 20, maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 };

export default function CrewOfferView({ token, initial }: { token: string; initial: OfferView | null }) {
  const [v, setV] = useState(initial);
  const [note, setNote] = useState(initial?.reply ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!v) return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...cardS, textAlign: "center" }}><h1 style={{ fontSize: 20, margin: 0 }}>This link isn&apos;t working</h1>
        <p style={{ color: "#5f626a", margin: 0 }}>The offer may have been withdrawn. If you were expecting one, get in touch with whoever asked you.</p></div>
    </div>
  );

  async function answer(a: "available" | "unavailable") {
    setBusy(true); setErr(null);
    const r = await fetch(`/api/crew-offer/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer: a, note }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setV(j); else setErr(j.error ?? "That didn't send. Try again.");
  }

  const rows: [string, string | null][] = [["Job", v.job.role], ["For", v.job.for], ["When", [v.job.date, v.job.time].filter(Boolean).join(" · ")], ["Where", v.job.location], ["Pay", v.job.pay]];
  const tone = v.status === "booked" ? { background: "#dcfce7", color: "#14532d" } : v.status === "available" ? { background: "#e0f2fe", color: "#0c4a6e" } : v.canAnswer ? { background: "#fef3c7", color: "#78350f" } : { background: "#eef0f3", color: "#3f434a" };
  return (
    <main style={page}>
      <div style={cardS}>
        <div style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "#5f626a" }}>{v.job.company}</div>
        <h1 style={{ fontSize: 24, lineHeight: 1.2, margin: 0 }}>Hi {v.name}</h1>
        <div role="status" style={{ ...tone, padding: "12px 14px", borderRadius: 8, fontWeight: 600 }}>{v.message}</div>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px" }}>
          {rows.filter(([, val]) => val).map(([k, val]) => <div key={k} style={{ display: "contents" }}><dt style={{ color: "#5f626a" }}>{k}</dt><dd style={{ margin: 0, fontWeight: 700 }}>{val}</dd></div>)}
        </dl>
        {v.job.notes && <p style={{ margin: 0, whiteSpace: "pre-wrap", background: "#f4f5f7", padding: 12, borderRadius: 8 }}>{v.job.notes}</p>}
        {v.canAnswer && (
          <>
            <div><label htmlFor="note" style={{ display: "block", fontSize: 13, color: "#5f626a", marginBottom: 4 }}>Anything we should know? (optional)</label>
              <input id="note" value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="e.g. Free from 10:00" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 16, border: "1px solid #c9ced6", borderRadius: 8 }} /></div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" disabled={busy} onClick={() => answer("available")} style={{ flex: 1, minWidth: 140, padding: "14px 16px", fontSize: 17, fontWeight: 700, borderRadius: 10, border: "none", background: "#15803d", color: "#fff", cursor: "pointer" }}>I&apos;m available</button>
              <button type="button" disabled={busy} onClick={() => answer("unavailable")} style={{ flex: 1, minWidth: 140, padding: "14px 16px", fontSize: 17, fontWeight: 700, borderRadius: 10, border: "2px solid #1a1d21", background: "#fff", color: "#1a1d21", cursor: "pointer" }}>Can&apos;t do it</button>
            </div>
            {err && <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>{err}</p>}
            <p style={{ fontSize: 13, color: "#5f626a", margin: 0 }}>Saying you&apos;re available doesn&apos;t book you: we&apos;ll confirm.</p>
          </>
        )}
        {v.job.phone && <p style={{ fontSize: 14, margin: 0 }}>Questions? Call <span style={{ fontWeight: 700, userSelect: "all" }}>{v.job.phone}</span></p>}
      </div>
    </main>
  );
}
