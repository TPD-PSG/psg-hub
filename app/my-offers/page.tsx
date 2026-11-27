// Crew offers for the signed-in person (crew who also have a Hub login)
import { serverApi } from "@/lib/serverApi";
import Link from "next/link";

export const metadata = { title: "My crew offers · PSG Hub" };
type Row = { link: string; status: string; role: string; date: string; callTime: string | null; for: string | null };
const LABEL: Record<string, string> = { offered: "Waiting for your answer", available: "You said you're available", unavailable: "You said you can't", booked: "Booked", released: "No longer needed" };

export default async function MyOffersPage() {
  const data = await serverApi<{ offers: Row[] }>("/api/my-crew-offers");
  const offers = data && "offers" in data ? data.offers : [];
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-white">My crew offers</h1>
      <p className="text-sm" style={{ color: "var(--psg-muted)" }}>Jobs you&apos;ve been asked to do, from today on. Open one to say whether you&apos;re free.</p>
      {offers.length === 0 ? <p className="text-sm" style={{ color: "var(--psg-muted)" }}>Nothing at the moment. Offers go to the email address in the crew directory; if yours is different from your Hub login, they won&apos;t show here.</p> : (
        <ul className="rounded-lg border divide-y" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          {offers.map(o => (
            <li key={o.link}><Link href={o.link} className="block px-4 py-3 hover:bg-white/5">
              <span className="font-semibold text-white">{o.role}</span>{o.for ? <span style={{ color: "var(--psg-muted)" }}> · {o.for}</span> : null}
              <span className="block text-sm" style={{ color: "var(--psg-muted)" }}>{new Date(o.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}{o.callTime ? `, call ${o.callTime}` : ""} · {LABEL[o.status] ?? o.status}</span>
            </Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
