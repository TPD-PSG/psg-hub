// Call times on a call sheet: reading "08:00"-style times and putting rows in call order. No
// database here, so the page, the PDF and the server all share it.

/** "8:00", "08:00", "8.00", "0800" → minutes after midnight, for sorting; null when it isn't a time. */
export function callMinutes(t: string | null | undefined): number | null {
  const m = (t ?? "").trim().match(/^(\d{1,2})[:.]?(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}
/** One list by call time, earliest first; rows without a time go last, then by name. */
export function byCallTime<T extends { callTime: string | null; name: string | null; discipline: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const x = callMinutes(a.callTime), y = callMinutes(b.callTime);
    if (x !== y) return x == null ? 1 : y == null ? -1 : x - y;
    return (a.name ?? a.discipline).localeCompare(b.name ?? b.discipline);
  });
}
