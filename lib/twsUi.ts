// Shared styles for pages inside a company space (they read the --tws-* tokens set by the shell)
import type { CSSProperties } from "react";

export const caps: CSSProperties = { fontFamily: "var(--tws-caps-font), var(--tws-font), sans-serif", fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--tws-accent-ink)" };
export const card: CSSProperties = { background: "var(--tws-card)", border: "1px solid var(--tws-line)", padding: 24 };
export const darkCard: CSSProperties = { background: "var(--tws-char)", color: "#fff", padding: 24 };
export const h2: CSSProperties = { margin: 0, fontSize: 18, fontWeight: 800, color: "var(--tws-ink)" };
export const muted: CSSProperties = { color: "var(--tws-muted)" };
export const link: CSSProperties = { color: "var(--tws-accent-ink)", fontWeight: 600 };
export const btnSolid: CSSProperties = { background: "var(--tws-char)", color: "#fff", padding: "11px 18px", fontSize: 14, fontWeight: 700, border: "2px solid var(--tws-char)", cursor: "pointer", textDecoration: "none", display: "inline-block" };
export const btnLine: CSSProperties = { background: "transparent", color: "var(--tws-char)", padding: "11px 16px", fontSize: 14, fontWeight: 700, border: "2px solid var(--tws-char)", cursor: "pointer", textDecoration: "none", display: "inline-block" };
export const input: CSSProperties = { width: "100%", boxSizing: "border-box", background: "#fff", color: "var(--tws-ink)", border: "1px solid var(--tws-line)", padding: "8px 10px", fontSize: 14, fontFamily: "inherit", borderRadius: 0 };
export const label: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--tws-muted)", marginBottom: 4 };
export const pageHeader: CSSProperties = { background: "var(--tws-card)", borderBottom: "6px solid var(--tws-char)" };

/** Stage colours on the light ground: done = charcoal, current = accent, to come = tint. */
export const stageTone = (state: "done" | "now" | "todo"): CSSProperties =>
  state === "done" ? { background: "var(--tws-char)", color: "#fff" }
    : state === "now" ? { background: "var(--tws-accent)", color: "var(--tws-ink)" }
      : { background: "var(--tws-tint)", color: "#4e545b" };

/** Fills that tell builds apart in the planner (labels always carry the name too). */
export const JOB_FILLS: CSSProperties[] = [
  { background: "var(--tws-accent)", border: "1px solid var(--tws-accent-ink)", color: "var(--tws-ink)" },
  { background: "#a9aeb4", border: "1px solid #5b5f66", color: "var(--tws-ink)" },
  { background: "#ffffff", border: "2px solid var(--tws-char)", color: "var(--tws-ink)" },
  { background: "var(--tws-accent-light)", border: "1px solid var(--tws-accent-ink)", color: "var(--tws-ink)" },
  { background: "var(--tws-char)", border: "1px solid var(--tws-night)", color: "#ffffff" },
  { background: "var(--tws-tint)", border: "1px dashed #8a8f96", color: "var(--tws-ink)" },
];

export const dayChip = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "Europe/London" }).toUpperCase();
