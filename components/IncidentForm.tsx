"use client";

// The accident & incident report form (26 Nov 2026). One form, two looks: inside the Hub (dark, on a
// production's H&S tab) and on the no-login QR page crew open on their phones (light, big targets).
import { useState } from "react";
import { INCIDENT_KINDS, INJURED_ROLES, TREATMENTS } from "@/lib/incidentsCore";
import { shrinkPhoto } from "@/lib/shrinkPhoto";

export type PhotoOut = { name: string; dataUrl: string };
/** Shrink phone photos to JPEG and read them as data URLs for the report. */
export async function photosFrom(files: FileList | File[], room: number): Promise<PhotoOut[]> {
  const out: PhotoOut[] = [];
  for (const f of Array.from(files).filter(x => x.type.startsWith("image/")).slice(0, room)) {
    const small = await shrinkPhoto(f, 1600, 0.8);
    const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(small); });
    out.push({ name: small.name, dataUrl });
  }
  return out;
}

type Look = "hub" | "public";
const LOOKS = {
  hub: {
    input: { width: "100%", padding: "8px 10px", border: "1px solid var(--psg-card-border)", borderRadius: 6, fontSize: 14, color: "var(--inc-ink, #fff)", backgroundColor: "var(--inc-field, rgba(255,255,255,0.04))", boxSizing: "border-box" as const },
    label: { display: "block", fontSize: 12, fontWeight: 600, color: "var(--psg-muted)", marginBottom: 4 },
    group: { borderTop: "1px solid var(--psg-card-border)", paddingTop: 14 },
    heading: { fontSize: 13, fontWeight: 700, color: "var(--inc-ink, #fff)", margin: "0 0 10px" },
    hint: { fontSize: 12, color: "var(--psg-muted)" },
    choice: (on: boolean) => ({ border: `1px solid ${on ? "var(--psg-blue)" : "var(--psg-card-border)"}`, backgroundColor: on ? "var(--inc-pick, rgba(59,130,246,0.15))" : "transparent", color: on ? "var(--inc-ink, #fff)" : "var(--psg-muted)", borderRadius: 6, padding: "8px 10px", fontSize: 13, textAlign: "left" as const, cursor: "pointer" }),
    button: { padding: "10px 16px", backgroundColor: "var(--psg-blue)", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer" },
    error: { color: "var(--inc-bad-ink, #fca5a5)", fontSize: 13 },
  },
  public: {
    input: { width: "100%", padding: "11px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 16, color: "#0f172a", backgroundColor: "#fff", boxSizing: "border-box" as const },
    label: { display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 4 },
    group: { backgroundColor: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "18px 20px" },
    heading: { fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 12px" },
    hint: { fontSize: 13, color: "#64748b" },
    choice: (on: boolean) => ({ border: `2px solid ${on ? "#b91c1c" : "#e2e8f0"}`, backgroundColor: on ? "#fef2f2" : "#fff", color: "#0f172a", borderRadius: 8, padding: "12px", fontSize: 15, textAlign: "left" as const, cursor: "pointer" }),
    button: { width: "100%", padding: "15px", backgroundColor: "#b91c1c", color: "#fff", border: "none", borderRadius: 10, fontSize: 17, fontWeight: 700, cursor: "pointer" },
    error: { color: "#dc2626", fontSize: 14 },
  },
} satisfies Record<Look, Record<string, unknown>>;

const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export default function IncidentForm({ look, venues, reporterName = "", submitUrl, onDone, submitLabel = "Send report" }: {
  look: Look; venues: string[]; reporterName?: string; submitUrl: string; onDone: (result: unknown) => void; submitLabel?: string;
}) {
  const L = LOOKS[look];
  const [f, setF] = useState({
    kind: "", occurredAt: nowLocal(), location: "", venueName: venues.length === 1 ? venues[0] : "", description: "", immediateAction: "",
    injuredName: "", injuredRole: "", injuredEmployer: "", injuryDetails: "", bodyPart: "", treatment: "", offWork: false,
    witnesses: "", reporterName, reporterContact: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState<PhotoOut[]>([]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  const hurt = f.kind === "accident" || f.kind === "ill_health";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.kind) { setError("Pick what kind of incident it was"); return; }
    setBusy(true); setError("");
    const res = await fetch(submitUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, occurredAt: new Date(f.occurredAt).toISOString(), photos }) }).catch(() => null);
    setBusy(false);
    const d = await res?.json().catch(() => ({}));
    if (!res?.ok) { setError(d?.error ?? "Couldn't send it. Check your signal and try again."); return; }
    onDone(d);
  }

  const field = (label: string, el: React.ReactNode, id: string) => <div><label htmlFor={id} style={L.label}>{label}</label>{el}</div>;
  const area = (k: keyof typeof f, id: string, rows = 3, placeholder = "", required = false) =>
    <textarea id={id} required={required} rows={rows} style={{ ...L.input, resize: "vertical" }} value={f[k] as string} onChange={set(k)} placeholder={placeholder} />;

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      <div style={{ ...L.group, ...(look === "hub" ? { borderTop: "none", paddingTop: 0 } : {}) }}>
        <p style={L.heading}>What happened? *</p>
        <div role="radiogroup" aria-label="Kind of incident" style={{ display: "grid", gap: 8, gridTemplateColumns: look === "hub" ? "repeat(auto-fill, minmax(190px, 1fr))" : "1fr" }}>
          {INCIDENT_KINDS.map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={f.kind === k} onClick={() => setF({ ...f, kind: k })} style={L.choice(f.kind === k)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ ...L.group, display: "grid", gap: 12 }}>
        <p style={{ ...L.heading, marginBottom: 0 }}>When and where</p>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {field("Date and time *", <input id="inc-when" type="datetime-local" required max={nowLocal()} style={L.input} value={f.occurredAt} onChange={set("occurredAt")} />, "inc-when")}
          {venues.length > 1
            ? field("Venue", <select id="inc-venue" style={L.input} value={f.venueName} onChange={set("venueName")}><option value="">Choose…</option>{venues.map(v => <option key={v}>{v}</option>)}</select>, "inc-venue")
            : field("Venue", <input id="inc-venue" style={L.input} value={f.venueName} onChange={set("venueName")} />, "inc-venue")}
        </div>
        {field("Where exactly", <input id="inc-where" style={L.input} value={f.location} onChange={set("location")} placeholder="e.g. Stage left wing, get-in dock, flys" />, "inc-where")}
        {field("What happened *", area("description", "inc-what", 4, "What were people doing, what went wrong, and what was the result?", true), "inc-what")}
        {field("What was done straight away", area("immediateAction", "inc-done", 2, "e.g. Area cordoned off, first aid given, kit taken out of use"), "inc-done")}
      </div>

      {hurt && (
        <div style={{ ...L.group, display: "grid", gap: 12 }}>
          <p style={{ ...L.heading, marginBottom: 0 }}>The person affected</p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {field("Their name", <input id="inc-who" style={L.input} value={f.injuredName} onChange={set("injuredName")} />, "inc-who")}
            {field("They are", <select id="inc-role" style={L.input} value={f.injuredRole} onChange={set("injuredRole")}><option value="">Choose…</option>{INJURED_ROLES.map(r => <option key={r}>{r}</option>)}</select>, "inc-role")}
            {field("Their employer", <input id="inc-emp" style={L.input} value={f.injuredEmployer} onChange={set("injuredEmployer")} />, "inc-emp")}
            {field("Part of the body", <input id="inc-body" style={L.input} value={f.bodyPart} onChange={set("bodyPart")} placeholder="e.g. Left hand" />, "inc-body")}
          </div>
          {field("The injury or illness", area("injuryDetails", "inc-injury", 2, "e.g. Cut to finger, bruising"), "inc-injury")}
          {field("Treatment", <select id="inc-treat" style={L.input} value={f.treatment} onChange={set("treatment")}><option value="">Choose…</option>{TREATMENTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>, "inc-treat")}
          <label style={{ display: "flex", gap: 10, alignItems: "center", ...L.hint }}>
            <input type="checkbox" checked={f.offWork} onChange={set("offWork")} style={{ width: 18, height: 18 }} /> They&apos;ve had to stop work or go home
          </label>
        </div>
      )}

      <div style={{ ...L.group, display: "grid", gap: 10 }}>
        <p style={{ ...L.heading, marginBottom: 0 }}>Photos</p>
        <p style={{ ...L.hint, margin: 0 }}>Of the hazard, the damage or the scene, if it&apos;s safe to take them. Up to 4. Not of anyone&apos;s injury.</p>
        {photos.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {photos.map((p, n) => (
              <div key={n} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.dataUrl} alt={`Photo ${n + 1}`} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 6, display: "block" }} />
                <button type="button" aria-label={`Remove photo ${n + 1}`} onClick={() => setPhotos(photos.filter((_, i) => i !== n))}
                  style={{ position: "absolute", top: 2, right: 2, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", cursor: "pointer", lineHeight: "24px" }}>×</button>
              </div>
            ))}
          </div>
        )}
        {photos.length < 4 && (
          <label style={{ ...L.choice(false), display: "inline-block", width: "auto", justifySelf: "start" }}>
            + Add photos
            <input type="file" accept="image/*" multiple style={{ display: "none" }}
              onChange={async e => { const files = e.target.files; if (files?.length) { const more = await photosFrom(files, 4 - photos.length); setPhotos(p => [...p, ...more]); } e.target.value = ""; }} />
          </label>
        )}
      </div>

      <div style={{ ...L.group, display: "grid", gap: 12 }}>
        {field("Witnesses", <input id="inc-wit" style={L.input} value={f.witnesses} onChange={set("witnesses")} placeholder="Names, and a phone number if you have one" />, "inc-wit")}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {field("Your name *", <input id="inc-me" required style={L.input} value={f.reporterName} onChange={set("reporterName")} />, "inc-me")}
          {field("Your phone or email", <input id="inc-contact" style={L.input} value={f.reporterContact} onChange={set("reporterContact")} placeholder="So we can follow up" />, "inc-contact")}
        </div>
        <p style={{ ...L.hint, margin: 0 }}>Only the production&apos;s managers and the H&amp;S leads see this report.</p>
      </div>

      {error && <p role="alert" style={{ ...L.error, margin: 0 }}>{error}</p>}
      <div><button type="submit" disabled={busy} style={{ ...L.button, opacity: busy ? 0.7 : 1 }}>{busy ? "Sending…" : submitLabel}</button></div>
    </form>
  );
}
