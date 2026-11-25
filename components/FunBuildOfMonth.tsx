// Fun Corner: each company space's build of the month (winner and this month's vote)
import Link from "next/link";
import type { Botm } from "@/components/BuildOfMonth";

export type SpaceBotm = { id: number; name: string; shortName: string | null; slug: string; botm: Botm };

export default function FunBuildOfMonth({ spaces }: { spaces: SpaceBotm[] }) {
  const shown = spaces.filter(s => s.botm.winner || s.botm.nominees.length);
  if (!shown.length) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2 mb-6 max-w-2xl mx-auto px-4 pt-8">
      {shown.map(s => {
        const lead = s.botm.nominees[0];
        const pic = s.botm.winner?.photo ?? lead?.photo;
        return (
          <section key={s.id} className="rounded-xl border overflow-hidden flex" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            {pic && (
              // eslint-disable-next-line @next/next/no-img-element -- served by our own API with access checks
              <img src={pic.url} alt="" className="w-32 object-cover shrink-0" />
            )}
            <div className="p-4 flex flex-col gap-1 min-w-0">
              <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>{s.shortName ?? s.name} · Build of the month</span>
              {s.botm.winner && <span className="text-sm text-white"><strong>{s.botm.winner.monthLabel}:</strong> {s.botm.winner.job.title}</span>}
              {lead && <span className="text-sm" style={{ color: "var(--psg-muted)" }}>{s.botm.monthLabel}: {s.botm.nominees.length} nominee{s.botm.nominees.length === 1 ? "" : "s"}, {lead.job.title} leading</span>}
              <Link href={`/spaces/${s.slug}/noticeboard`} className="text-sm text-blue-300 hover:underline mt-1">{s.botm.myVote ? "Change your vote →" : "Vote →"}</Link>
            </div>
          </section>
        );
      })}
    </div>
  );
}
