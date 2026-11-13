"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";

type Production = { name: string; isTour: boolean; tourStops?: { id: number; venueName?: string; venue: { name: string } }[] };

function ToolboxForm() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const stopId = searchParams.get("stopId");

  const [prod, setProd] = useState<Production | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    signeeName: "",
    employer: "",
    position: "",
    signeeDate: new Date().toISOString().slice(0, 10),
    agreedBriefing: false,
    agreedSafety: false,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fetch(`/api/productions/${id}`)
      .then(r => r.json())
      .then(d => { setProd(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const venueName = (() => {
    if (!prod) return "";
    if (stopId && prod.tourStops) {
      const stop = prod.tourStops.find(s => String(s.id) === stopId);
      return stop?.venue?.name ?? "";
    }
    return "";
  })();

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current; if (!canvas) return;
    setDrawing(true);
    lastPos.current = getPos(e, canvas);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
    lastPos.current = pos;
    setHasSig(true);
  }

  function endDraw() { setDrawing(false); lastPos.current = null; }

  function clearSig() {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasSig) { setError("Please sign in the box above."); return; }
    if (!form.agreedBriefing || !form.agreedSafety) { setError("Please tick both declarations to continue."); return; }
    setError("");
    setSubmitting(true);
    const signature = canvasRef.current!.toDataURL("image/png");
    try {
      const res = await fetch(`/api/productions/${id}/toolbox-signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, signature, tourStopId: stopId ? Number(stopId) : null, venueName }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8fafc" }}>
      <p style={{ color: "#64748b" }}>Loading…</p>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ backgroundColor: "#f8fafc" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Sign-off complete</h1>
      <p style={{ color: "#64748b", maxWidth: 360 }}>Thank you, {form.signeeName}. Your CDM Toolbox Talk sign-off has been recorded.</p>
    </div>
  );

  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 15, color: "#0f172a", backgroundColor: "#fff", outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 4 };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", padding: "24px 16px 48px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ backgroundColor: "#1e3a5f", borderRadius: 12, padding: "20px 24px", marginBottom: 24, color: "white" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7, marginBottom: 4 }}>CDM Toolbox Talk</p>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{prod?.name ?? "Sign-off"}</h1>
          {venueName && <p style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{venueName}</p>}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Personal details */}
          <div style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px 24px", marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16, marginTop: 0 }}>Your Details</h2>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={lbl}>Full Name *</label>
                <input required style={inp} value={form.signeeName} onChange={e => setForm(f => ({ ...f, signeeName: e.target.value }))} placeholder="Your full name" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={lbl}>Employer *</label>
                  <input required style={inp} value={form.employer} onChange={e => setForm(f => ({ ...f, employer: e.target.value }))} placeholder="Company name" />
                </div>
                <div>
                  <label style={lbl}>Position / Role *</label>
                  <input required style={inp} value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Your role" />
                </div>
              </div>
              <div>
                <label style={lbl}>Date *</label>
                <input required type="date" style={inp} value={form.signeeDate} onChange={e => setForm(f => ({ ...f, signeeDate: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Declarations */}
          <div style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px 24px", marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16, marginTop: 0 }}>Declarations</h2>

            <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", marginBottom: 16 }}>
              <input type="checkbox" checked={form.agreedBriefing} onChange={e => setForm(f => ({ ...f, agreedBriefing: e.target.checked }))}
                style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: "#1e3a5f" }} />
              <span style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.5 }}>
                <strong>I have attended and fully understood the CDM Safety Briefing before commencing work.</strong>
                <br />
                <span style={{ color: "#475569" }}>Including, but not limited to:</span>
                <ul style={{ margin: "6px 0 0 0", paddingLeft: 20, color: "#475569", fontSize: 13 }}>
                  <li>Perimeter of the Construction Zone</li>
                  <li>Schedule and Scope of Works</li>
                  <li>Site Rules</li>
                  <li>Fire and Emergency Procedures</li>
                  <li>First Aid and Welfare Arrangements</li>
                  <li>Contact Details of those in charge</li>
                  <li>Information about significant risks</li>
                </ul>
              </span>
            </label>

            <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={form.agreedSafety} onChange={e => setForm(f => ({ ...f, agreedSafety: e.target.checked }))}
                style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: "#1e3a5f" }} />
              <span style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.5 }}>
                I agree to follow all parts of the Safety Briefing from both Production and Venue, and if I am unsure about anything check with a senior member of the team.
              </span>
            </label>
          </div>

          {/* Signature */}
          <div style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px 24px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>Signature *</h2>
              <button type="button" onClick={clearSig} style={{ fontSize: 12, color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>Clear</button>
            </div>
            <canvas
              ref={canvasRef}
              width={520}
              height={150}
              style={{ width: "100%", height: 150, border: "1px solid #cbd5e1", borderRadius: 8, backgroundColor: "#fafafa", touchAction: "none", cursor: "crosshair", display: "block" }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 6, marginBottom: 0 }}>Draw your signature above</p>
          </div>

          {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <button type="submit" disabled={submitting} style={{ width: "100%", padding: "14px", backgroundColor: "#1e3a5f", color: "white", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Submitting…" : "Submit Sign-off"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ToolboxTalkPage() {
  return <Suspense><ToolboxForm /></Suspense>;
}
