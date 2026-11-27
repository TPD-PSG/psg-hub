// What a crew member sees on their private offer link, and whether they can still answer.
import { dayLabel, payLabel } from "@/lib/crewOffers";

type O = {
  status: string; reply: string | null; crew: { name: string };
  job: { role: string; date: Date; callTime: string | null; endTime: string | null; location: string | null; notes: string | null; places: number; payRate: number | null; payUnit: string; hours: number | null;
    hire: { title: string; entity: { name: string; phone: string | null } } | null; production: { name: string } | null; offers: { status: string }[] };
};

export function offerForCrew(o: O) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const past = o.job.date < today;
  const full = o.job.offers.filter(x => x.status === "booked").length >= o.job.places;
  const booked = o.status === "booked", released = o.status === "released";
  const canAnswer = !past && !booked && !released && !full;
  const message = booked ? "You're booked for this. If anything changes, call us." : released ? "We no longer need you for this one. Thank you for being available."
    : past ? "This job has been and gone." : full ? "Thanks, but this one's been filled." : o.status === "available" ? "Thanks: you've said you're available. We'll be in touch to confirm." : o.status === "unavailable" ? "Thanks: you've said you can't do it. Change your answer below if that's changed." : "Are you free for this?";
  return {
    name: o.crew.name.split(/\s+/)[0], status: o.status, reply: o.reply, canAnswer, message,
    job: {
      role: o.job.role, for: o.job.hire?.title ?? o.job.production?.name ?? null, date: dayLabel(o.job.date),
      time: o.job.callTime ? `Call ${o.job.callTime}${o.job.endTime ? ` to ${o.job.endTime}` : ""}` : null,
      location: o.job.location, notes: o.job.notes, pay: payLabel(o.job),
      company: o.job.hire?.entity.name ?? "Production Solutions Group", phone: o.job.hire?.entity.phone ?? null,
    },
  };
}
