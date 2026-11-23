// Shared date and money formatting (UK style). Pages used to carry ~25 copies of these.
type DateInput = string | Date;

const d = (s: DateInput) => (s instanceof Date ? s : new Date(s));

/** "1 Jan 2026"; `empty` (default "—") when there's no date. */
export function fmtDate(s: DateInput | null | undefined, empty = "—"): string {
  return s ? d(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : empty;
}

/** "1 Jan" (no year); `empty` (default "") when there's no date. */
export function fmtDay(s: DateInput | null | undefined, empty = ""): string {
  return s ? d(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : empty;
}

/** "Mon 1 Jan 2026". */
export function fmtWeekdayDate(s: DateInput): string {
  return d(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** "19:30". */
export function fmtTime(s: DateInput): string {
  return d(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "1 Jan 19:30"; "" when there's no date. */
export function fmtDayTime(s: DateInput | null | undefined): string {
  return s ? `${fmtDay(s)} ${fmtTime(s)}` : "";
}

/** "1 Jan 2026, 19:30". */
export function fmtDateTime(s: DateInput): string {
  return d(s).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "November 2026" from "2026-11". */
export function fmtMonthYear(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
}

/** "£1,200.50", or "£1,201" with `{ whole: true }`. */
export function fmtMoney(n: number, opts: { whole?: boolean } = {}): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", ...(opts.whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2 }) }).format(n);
}
