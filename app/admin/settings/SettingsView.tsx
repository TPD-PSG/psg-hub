"use client";
import { BUILTIN_CONTACT_SECTIONS, CONTACT_SECTIONS_SETTING, defaultSections } from "@/lib/contactSections";

import { useEffect, useState } from "react";
import SeasonalOverlay from "@/components/SeasonalOverlay";
import SystemStatus from "@/components/SystemStatus";
import type { JobStatus } from "@/lib/job-status";

export type QuickLink = { id: number; label: string; url: string; icon: string; order: number };
type SeasonMode = "auto" | "off" | "christmas" | "halloween" | "spring" | "bonfire" | "newyear";
type SeasonIntensity = "light" | "normal" | "heavy";

const SEASON_OPTIONS: { value: SeasonMode; label: string; desc: string }[] = [
  { value: "auto",      label: "Auto (date-based)",  desc: "Activates automatically based on the time of year" },
  { value: "off",       label: "Off",                desc: "No seasonal effects" },
  { value: "christmas", label: "❄️ Christmas Snow",   desc: "Falling snow (also active Dec 1–Jan 5)" },
  { value: "halloween", label: "🦇 Halloween",        desc: "Bats, spiders & falling leaves (also active Oct 25–31)" },
  { value: "spring",    label: "🌸 Spring Blossom",   desc: "Cherry blossom & flower petals (also active Mar 20–Apr 10)" },
  { value: "bonfire",   label: "🎆 Bonfire Night",    desc: "Firework sparks & embers (5 Nov)" },
  { value: "newyear",   label: "🎉 New Year",         desc: "Confetti & streamers" },
];

const inp = "w-full rounded px-3 py-2 text-sm text-white border focus:outline-none focus:ring-1 focus:ring-blue-500";
const inpStyle = { backgroundColor: "var(--psg-dark-bg)", borderColor: "var(--psg-card-border)" };

export type SettingsInitial = { settings: Record<string, string>; links: QuickLink[]; jobs: JobStatus[] | null } | null;

export default function SettingsView({ initial }: { initial: SettingsInitial }) {
  const st = initial?.settings;
  const [news, setNews] = useState(st?.news ?? "");
  const [sections, setSections] = useState<string[]>(st ? defaultSections(st[CONTACT_SECTIONS_SETTING]) : BUILTIN_CONTACT_SECTIONS);
  const [newSection, setNewSection] = useState("");
  const [sectionsSaved, setSectionsSaved] = useState(false);
  const [newsSaved, setNewsSaved] = useState(false);
  const [links, setLinks] = useState<QuickLink[]>(initial?.links ?? []);
  const [addForm, setAddForm] = useState({ label: "", url: "", icon: "🔗" });
  const [adding, setAdding] = useState(false);

  // Seasonal effects
  const [seasonMode, setSeasonMode] = useState<SeasonMode>((st?.seasonal_mode as SeasonMode) || "auto");
  const [seasonIntensity, setSeasonIntensity] = useState<SeasonIntensity>((st?.seasonal_intensity as SeasonIntensity) || "normal");
  const [seasonSaved, setSeasonSaved] = useState(false);
  const [previewSeason, setPreviewSeason] = useState<"christmas" | "halloween" | "spring" | "bonfire" | "newyear" | null | undefined>(undefined);
  const [previewIntensity, setPreviewIntensity] = useState<SeasonIntensity | undefined>(undefined);

  // Settings and quick links arrive with the page; fetch them here only if that failed
  useEffect(() => {
    if (initial) return;
    fetch("/api/settings").then(r => r.json()).then((d: Record<string, string>) => {
      if (d?.news) setNews(d.news);
      setSections(defaultSections(d?.[CONTACT_SECTIONS_SETTING]));
      if (d?.seasonal_mode) setSeasonMode(d.seasonal_mode as SeasonMode);
      if (d?.seasonal_intensity) setSeasonIntensity(d.seasonal_intensity as SeasonIntensity);
    });
    fetch("/api/quicklinks").then(r => r.json()).then(d => { if (Array.isArray(d)) setLinks(d); });
  }, [initial]);

  async function saveNews(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "news", value: news }) });
    setNewsSaved(true);
    setTimeout(() => setNewsSaved(false), 2000);
  }

  async function saveSections(next: string[]) {
    setSections(next);
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: CONTACT_SECTIONS_SETTING, value: JSON.stringify(next) }) });
    setSectionsSaved(true);
    setTimeout(() => setSectionsSaved(false), 2000);
  }

  async function clearNews() {
    await fetch("/api/settings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "news" }) });
    setNews("");
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/quicklinks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...addForm, order: links.length }) });
    const link = await res.json();
    setLinks(l => [...l, link]);
    setAddForm({ label: "", url: "", icon: "🔗" });
    setAdding(false);
  }

  async function saveSeasonalSettings() {
    await Promise.all([
      fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "seasonal_mode", value: seasonMode }) }),
      fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "seasonal_intensity", value: seasonIntensity }) }),
    ]);
    setPreviewSeason(undefined);
    setPreviewIntensity(undefined);
    setSeasonSaved(true);
    setTimeout(() => setSeasonSaved(false), 2000);
  }

  function handlePreview() {
    const validSeasons = ["christmas", "halloween", "spring", "bonfire", "newyear"] as const;
    const s = validSeasons.find(v => v === seasonMode) ?? null;
    setPreviewSeason(s);
    setPreviewIntensity(seasonIntensity);
    setTimeout(() => { setPreviewSeason(undefined); setPreviewIntensity(undefined); }, 8000);
  }

  async function deleteLink(id: number) {
    await fetch("/api/quicklinks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setLinks(l => l.filter(x => x.id !== id));
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-white">Hub Settings</h1>

      <SystemStatus initialJobs={initial?.jobs ?? null} />

      {/* News banner */}
      <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <h2 className="font-semibold text-white">News Banner</h2>
        <p className="text-sm" style={{ color: "var(--psg-muted)" }}>
          Shown at the top of the home screen for all users. Leave blank to hide it.
        </p>
        <form onSubmit={saveNews} className="space-y-3">
          <input
            value={news}
            onChange={e => setNews(e.target.value)}
            placeholder="e.g. Office will be closed on 25 Dec — Merry Christmas!"
            className={inp}
            style={inpStyle}
          />
          <div className="flex gap-2">
            <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
              {newsSaved ? "Saved ✓" : "Save banner"}
            </button>
            {news && (
              <button type="button" onClick={clearNews} className="border px-4 py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Contact sheet sections */}
      <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Contact Sheet Sections</h2>
          {sectionsSaved && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>Saved ✓</span>}
        </div>
        <p className="text-sm" style={{ color: "var(--psg-muted)" }}>
          The default sections offered on every production&apos;s contact sheet, in this order. Productions can add their own too. Removing one here doesn&apos;t touch existing contacts.
        </p>
        <div className="space-y-1">
          {sections.map((s, i) => (
            <div key={s} className="flex items-center gap-2 rounded border px-3 py-1.5 text-sm" style={{ borderColor: "var(--psg-card-border)" }}>
              <span className="flex-1 text-white">{s}</span>
              <button type="button" disabled={i === 0} onClick={() => { const n = [...sections]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; saveSections(n); }}
                className="text-xs px-1.5 disabled:opacity-20" style={{ color: "var(--psg-muted)" }} aria-label={`Move ${s} up`}>↑</button>
              <button type="button" disabled={i === sections.length - 1} onClick={() => { const n = [...sections]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; saveSections(n); }}
                className="text-xs px-1.5 disabled:opacity-20" style={{ color: "var(--psg-muted)" }} aria-label={`Move ${s} down`}>↓</button>
              <button type="button" disabled={sections.length === 1} onClick={() => saveSections(sections.filter(x => x !== s))}
                className="text-xs px-1.5 text-red-400 disabled:opacity-20" aria-label={`Remove ${s}`}>✕</button>
            </div>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={e => {
          e.preventDefault();
          const t = newSection.trim();
          if (t && !sections.some(x => x.toLowerCase() === t.toLowerCase())) saveSections([...sections, t]);
          setNewSection("");
        }}>
          <input value={newSection} onChange={e => setNewSection(e.target.value)} placeholder="New section, e.g. Orchestra" className={inp} style={inpStyle} />
          <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity shrink-0" style={{ backgroundColor: "var(--psg-blue)" }}>Add</button>
        </form>
      </div>

      {/* Quick links */}
      <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Quick Links</h2>
          <button onClick={() => setAdding(a => !a)} className="text-sm px-3 py-1.5 rounded border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
            + Add link
          </button>
        </div>

        {adding && (
          <form onSubmit={addLink} className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-dark-bg)" }}>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Icon (emoji)</label>
                <input value={addForm.icon} onChange={e => setAddForm(f => ({ ...f, icon: e.target.value }))} className={inp} style={inpStyle} maxLength={2} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>Label</label>
                <input required value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} placeholder="Google Drive" className={inp} style={inpStyle} />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--psg-muted)" }}>URL</label>
              <input required value={addForm.url} onChange={e => setAddForm(f => ({ ...f, url: e.target.value }))} placeholder="https://drive.google.com/…" className={inp} style={inpStyle} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>Add</button>
              <button type="button" onClick={() => setAdding(false)} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
            </div>
          </form>
        )}

        {links.length === 0 && !adding && (
          <p className="text-sm" style={{ color: "var(--psg-muted)" }}>No quick links yet. Add links to external tools, documents or resources.</p>
        )}

        <div className="space-y-2">
          {links.map(l => (
            <div key={l.id} className="flex items-center gap-3 rounded-lg border px-4 py-3" style={{ borderColor: "var(--psg-card-border)" }}>
              <span className="text-lg">{l.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">{l.label}</div>
                <div className="text-xs truncate" style={{ color: "var(--psg-muted)" }}>{l.url}</div>
              </div>
              <button onClick={() => deleteLink(l.id)} className="text-xs hover:text-red-400 transition-colors shrink-0" style={{ color: "var(--psg-muted)" }}>Remove</button>
            </div>
          ))}
        </div>
      </div>
      {/* Seasonal effects */}
      <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <div>
          <h2 className="font-semibold text-white">Seasonal Effects</h2>
          <p className="text-sm mt-1" style={{ color: "var(--psg-muted)" }}>
            Decorative canvas overlay shown to all users. Respects reduced-motion preferences. Changes take effect on next page load.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--psg-muted)" }}>Effect</label>
            <div className="grid gap-2">
              {SEASON_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors hover:bg-white/5" style={{ borderColor: seasonMode === opt.value ? "var(--psg-blue)" : "var(--psg-card-border)", backgroundColor: seasonMode === opt.value ? "rgba(59,130,246,0.08)" : undefined }}>
                  <input type="radio" name="seasonMode" value={opt.value} checked={seasonMode === opt.value} onChange={() => setSeasonMode(opt.value)} className="mt-0.5 shrink-0 accent-blue-500" />
                  <div>
                    <div className="text-sm text-white font-medium">{opt.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--psg-muted)" }}>Intensity</label>
            <div className="flex gap-2">
              {(["light", "normal", "heavy"] as SeasonIntensity[]).map(v => (
                <button key={v} onClick={() => setSeasonIntensity(v)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors border"
                  style={seasonIntensity === v
                    ? { backgroundColor: "var(--psg-blue)", borderColor: "var(--psg-blue)", color: "white" }
                    : { borderColor: "var(--psg-card-border)", color: "var(--psg-muted)", backgroundColor: "transparent" }}>
                  {v === "light" ? "🌨 Light" : v === "normal" ? "❄️ Normal" : "🌨❄️ Heavy"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={saveSeasonalSettings} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
            {seasonSaved ? "Saved ✓" : "Save settings"}
          </button>
          {(seasonMode !== "auto" && seasonMode !== "off") && (
            <button onClick={handlePreview} className="border px-4 py-2 rounded text-sm hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
              ▶ Preview (8s)
            </button>
          )}
        </div>

        {previewSeason !== undefined && (
          <SeasonalOverlay previewSeason={previewSeason} previewIntensity={previewIntensity} />
        )}
      </div>
    </div>
  );
}
