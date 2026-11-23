// Tour Stops tab ordering (roadmap #16, Tom, 22 Nov): once the tour has left a venue,
// that stop drops to the bottom of the list. Exports keep plain date order.

type StopDates = {
  stopNumber: number;
  loadInDate?: string | Date | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  performanceEnd?: string | Date | null;
};

// Calendar date in UK time, e.g. "2026-11-22", so "left" flips at midnight here, not in UTC
const ukDay = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Europe/London" });

/** True once the stop's last day (get-out, else last show, else first day) is before today. */
export function hasLeftVenue(stop: StopDates, now: Date = new Date()): boolean {
  const last = stop.endDate ?? stop.performanceEnd ?? stop.startDate ?? stop.loadInDate;
  if (!last || Number.isNaN(new Date(last).getTime())) return false; // no dates yet: treat as upcoming
  return ukDay(last) < ukDay(now);
}

/** Upcoming and current stops first, then finished ones; each group in stop-number order. */
export function orderForTourList<T extends StopDates>(stops: T[], now: Date = new Date()): T[] {
  const byNumber = (a: T, b: T) => a.stopNumber - b.stopNumber;
  const upcoming = stops.filter(s => !hasLeftVenue(s, now)).sort(byNumber);
  const finished = stops.filter(s => hasLeftVenue(s, now)).sort(byNumber);
  return [...upcoming, ...finished];
}
