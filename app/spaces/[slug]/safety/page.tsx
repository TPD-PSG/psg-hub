// A workshop space's Safety page (26 Nov 2026): accidents and near misses on the floor.
import { notFound } from "next/navigation";
import Link from "next/link";
import { serverApi } from "@/lib/serverApi";
import { spaceBySlug } from "@/lib/spaces";
import { pageHeader, muted } from "@/lib/twsUi";
import IncidentsPanel from "@/components/IncidentsPanel";
import MachineInductions from "@/components/MachineInductions";
import Equipment from "@/components/Equipment";
import { auth } from "@/auth";

export default async function SafetyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  const [space, data] = await Promise.all([spaceBySlug(slug), serverApi<{ incidents?: unknown[] }>(`/api/spaces/${slug}/incidents`)]);
  if (!space || !data?.incidents) notFound();
  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-1.5">
        <div className="text-[13px]" style={muted}><Link href={`/spaces/${slug}`} style={{ color: "var(--tws-accent-ink)" }}>{space.name}</Link> › Safety</div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Safety</h1>
        <span className="text-sm" style={muted}>Accidents and near misses, equipment checks, and who&apos;s inducted on which machine. Emergency? Call 999 first.</span>
      </header>
      <div className="px-4 sm:px-10 py-6 flex flex-col gap-6 max-w-6xl">
        <div className="inc-light"><IncidentsPanel apiBase={`/api/spaces/${slug}`} placeName={space.name} venues={[space.name]} workshop /></div>
        <Equipment slug={slug} myName={(await auth())?.user?.name ?? ""} />
        <MachineInductions slug={slug} />
      </div>
    </>
  );
}
