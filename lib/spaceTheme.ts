// A company space's own look (from the TWS mockups, 25 Nov 2026): warm paper ground, charcoal
// ink and night-dark chrome, with the company's colour as the accent. A darker shade of the
// accent is used for links and labels on the light ground, a lighter one on the dark top bar.
const hexToHsl = (hex: string): [number, number, number] => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const hslToHex = (h: number, s: number, l: number) => {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [0, 8, 4].map(n => Math.round(f(n) * 255).toString(16).padStart(2, "0")).join("");
};
const withLightness = (hex: string, l: number, minSat = 0.35) => {
  const [h, s] = hexToHsl(hex);
  return hslToHex(h, Math.max(s, s > 0.05 ? minSat : 0), l);
};

export const DEFAULT_SPACE_ACCENT = "#c49a6c"; // TWS timber brass

/** CSS custom properties for a space's shell. */
export function spaceTokens(color: string | null): Record<string, string> {
  const accent = color && /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : DEFAULT_SPACE_ACCENT;
  return {
    "--tws-ground": "#f5f2ec", "--tws-card": "#ffffff", "--tws-tint": "#e8e3da", "--tws-tint-2": "#ece6db",
    "--tws-line": "#ddd6ca", "--tws-line-soft": "#eee9e0",
    "--tws-ink": "#24272b", "--tws-muted": "#5b5f66",
    "--tws-night": "#1f2226", "--tws-char": "#2f3236", "--tws-char-hi": "#3a3e44", "--tws-nav-ink": "#d9d4cb", "--tws-night-muted": "#c9ccd1",
    "--tws-accent": accent,
    "--tws-accent-ink": withLightness(accent, 0.33, 0.45), // links and labels on the light ground
    "--tws-accent-light": withLightness(accent, 0.78, 0.5), // on the dark top bar
    "--tws-warn-bg": "#fff6e5", "--tws-warn-line": "#e3c48f", "--tws-warn-ink": "#7a4a12",
    "--tws-bad-bg": "#fbe9e5", "--tws-bad-line": "#d99a8c", "--tws-bad-ink": "#a3361f",
  };
}

/**
 * PSG's own look for a space that's part of PSG itself (PSG Rentals & Crew): the Hub's navy, the
 * pale PSG blue for buttons and links, and PSG blue as the accent, on the same tokens the space
 * pages use. Text on a solid button, form fields and the top bar's name have their own tokens
 * (the workshop look falls back to its originals).
 */
export function psgSpaceTokens(): Record<string, string> {
  return {
    "--tws-ground": "#070b33", "--tws-card": "#0e1550", "--tws-tint": "#131d5e", "--tws-tint-2": "#1a2466",
    "--tws-line": "#22307a", "--tws-line-soft": "#1a2466",
    "--tws-ink": "#ffffff", "--tws-muted": "#aeb7e0",
    "--tws-night": "#000c3b", "--tws-char": "#c9d2f0", "--tws-char-hi": "#1a2466", "--tws-nav-ink": "#c9d2f0", "--tws-night-muted": "#aeb7e0",
    "--tws-on-char": "#000c3b", "--tws-field": "#070b33", "--tws-soft-ink": "#aeb7e0", "--tws-bar-ink": "#ffffff",
    "--tws-accent": "#3d44d4", "--tws-accent-ink": "#c9d2f0", "--tws-accent-light": "#243088",
    "--tws-warn-bg": "#2a2410", "--tws-warn-line": "#c99a3a", "--tws-warn-ink": "#f2c46b",
    "--tws-bad-bg": "#3a1620", "--tws-bad-line": "#ffb4a8", "--tws-bad-ink": "#ffb4a8",
    colorScheme: "dark",
  };
}

/** The tokens for a space: PSG's own look for a rentals space, else the company's colour. */
export const tokensForSpace = (space: { kind?: string; color: string | null }) => (space.kind === "rentals" ? psgSpaceTokens() : spaceTokens(space.color));
