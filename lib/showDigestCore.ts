// The weekly show-report digest (28 Nov 2026), worked out from the reports' own summaries (no AI,
// so it costs nothing to run). Self-contained so tests can load it.
//   - performances, house %, running times
//   - which departments flagged problems
//   - incidents and absences as COUNTS only (no medical detail leaves the reports)
//   - repeat faults: the same cue ("LX 45", "SQ 12") or the same kit ("radio mic", "revolve")
//     in the technical or maintenance notes of two or more performances

export type DigestReport = {
  id: number; reportDate: string | Date; performance: string | null; performanceNumber: number | null; venue: string | null;
  attendance: number | null; houseCapacity: number | null; runningTime: string | null; notes: string | null; flags: string | null;
};
export type Repeat = { key: string; kind: "cue" | "kit"; count: number; reports: { id: number; label: string; text: string }[] };
export type Digest = {
  performances: number; attendance: number; avgHousePct: number | null; runningMin: string | null; runningMax: string | null;
  flagged: { section: string; count: number }[]; incidents: number; incidentShows: number; absences: number; absenceShows: number;
  repeats: Repeat[]; reports: { id: number; label: string; flags: string[] }[];
};

/** "**Technical – Sound**" headings → section name → its lines. */
export function sectionsOf(notes: string | null): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let cur: string | null = null;
  for (const raw of (notes ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    const h = line.match(/^\*\*(.+?)\*\*$/);
    if (h) { cur = h[1].trim(); out.set(cur, []); continue; }
    if (cur && line) out.get(cur)!.push(line.replace(/^[-*•]\s*/, ""));
  }
  return out;
}

const CUE = /\b(LX|LQ|SQ|FS|VQ|AQ|FQ|Sound\s*Q|Video\s*Q|Fly\s*Q|Auto(?:mation)?\s*Q|Cue|Q)\s*\.?\s*(\d{1,4}(?:\.\d{1,2})?[a-z]?)\b/gi;
const CUE_NAME: Record<string, string> = { lq: "LX", lx: "LX", soundq: "SQ", sq: "SQ", fs: "FS", vq: "VQ", videoq: "VQ", aq: "AQ", automationq: "AQ", autoq: "AQ", flyq: "FQ", fq: "FQ", cue: "Q", q: "Q" };
const KIT = ["radio mic", "mic pack", "RF", "comms", "cans", "sound desk", "lighting desk", "moving light", "follow spot", "projector", "LED wall", "haze", "smoke", "pyro", "confetti", "revolve", "truck", "automation", "winch", "fly bar", "flying", "lift", "trap", "show control", "QLab", "speaker", "amp", "DMX", "dimmer", "practical"];
const TECH = /technical|maintenance|automation|sound|lighting|video/i;

export const cuesIn = (text: string) => [...text.matchAll(CUE)].map(m => `${CUE_NAME[m[1].toLowerCase().replace(/\s+/g, "")] ?? m[1].toUpperCase()} ${m[2].toUpperCase()}`);
export const kitIn = (text: string) => KIT.filter(k => new RegExp(`\\b${k.replace(/ /g, "\\s+")}s?\\b`, k === "RF" || k === "DMX" || k === "QLab" ? "" : "i").test(text));

const minutes = (t: string | null) => { const m = t?.match(/^(\d+):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const label = (r: DigestReport) => {
  const d = new Date(r.reportDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return [r.performanceNumber ? `Show ${r.performanceNumber}` : null, d, r.performance].filter(Boolean).join(" · ");
};
const parseFlags = (f: string | null): string[] => { try { const v = JSON.parse(f ?? "[]"); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };

export function buildDigest(reports: DigestReport[]): Digest {
  const rs = [...reports].sort((a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime());
  const withHouse = rs.filter(r => r.attendance != null && r.houseCapacity);
  const runs = rs.map(r => ({ r, m: minutes(r.runningTime) })).filter(x => x.m != null) as { r: DigestReport; m: number }[];
  const flagCount = new Map<string, number>();
  let incidents = 0, incidentShows = 0, absences = 0, absenceShows = 0;
  const seen = new Map<string, Repeat>();
  for (const r of rs) {
    for (const f of parseFlags(r.flags)) flagCount.set(f, (flagCount.get(f) ?? 0) + 1);
    const secs = sectionsOf(r.notes);
    for (const [name, lines] of secs) {
      if (/health|incident|injur/i.test(name) && lines.length) { incidents += lines.length; incidentShows++; }
      if (/absence|cover/i.test(name) && lines.length) { absences += lines.length; absenceShows++; }
      if (!TECH.test(name)) continue;
      for (const line of lines) {
        const keys: [string, "cue" | "kit"][] = [...new Set(cuesIn(line))].map(k => [k, "cue"] as [string, "cue"]);
        for (const k of new Set(kitIn(line))) keys.push([k, "kit"]);
        for (const [k, kind] of keys) {
          const rep = seen.get(k) ?? { key: k, kind, count: 0, reports: [] };
          if (!rep.reports.some(x => x.id === r.id)) { rep.reports.push({ id: r.id, label: label(r), text: line.slice(0, 200) }); rep.count = rep.reports.length; }
          seen.set(k, rep);
        }
      }
    }
  }
  const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  return {
    performances: rs.length,
    attendance: rs.reduce((s, r) => s + (r.attendance ?? 0), 0),
    avgHousePct: withHouse.length ? Math.round((withHouse.reduce((s, r) => s + r.attendance! / r.houseCapacity!, 0) / withHouse.length) * 100) : null,
    runningMin: runs.length ? hm(Math.min(...runs.map(x => x.m))) : null,
    runningMax: runs.length ? hm(Math.max(...runs.map(x => x.m))) : null,
    flagged: [...flagCount].map(([section, count]) => ({ section, count })).sort((a, b) => b.count - a.count),
    incidents, incidentShows, absences, absenceShows,
    repeats: [...seen.values()].filter(r => r.count >= 2).sort((a, b) => b.count - a.count || (a.kind === "cue" ? -1 : 1)),
    reports: rs.map(r => ({ id: r.id, label: label(r), flags: parseFlags(r.flags) })),
  };
}

/** Monday 00:00 UTC of the week containing a YYYY-MM-DD (or today). */
export function mondayOf(day?: string | null): Date {
  const d = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00Z`) : new Date();
  const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return new Date(base - ((new Date(base).getUTCDay() + 6) % 7) * 86400e3);
}

/** One line for a notification. */
export const digestLine = (g: Digest) => [
  `${g.performances} performance${g.performances === 1 ? "" : "s"}`,
  g.avgHousePct != null ? `${g.avgHousePct}% average house` : null,
  g.repeats.length ? `${g.repeats.length} repeat fault${g.repeats.length === 1 ? "" : "s"} (${g.repeats.slice(0, 2).map(r => r.key).join(", ")})` : null,
  g.incidents ? `${g.incidents} incident${g.incidents === 1 ? "" : "s"}` : null,
  g.absences ? `${g.absences} absence${g.absences === 1 ? "" : "s"}` : null,
].filter(Boolean).join(" · ");
