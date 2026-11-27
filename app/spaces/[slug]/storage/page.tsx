// A company space's set storage: built pieces and where they've been put
import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/serverApi";
import type { SpaceTheme } from "@/lib/spaces";
import SetStorage, { type StorageData } from "@/components/SetStorage";
import { muted, pageHeader } from "@/lib/twsUi";
import { staffPageOrMyWork } from "@/lib/spaceStaffPage";

export default async function StoragePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,30}$/.test(slug)) notFound();
  await staffPageOrMyWork(slug); // freelancers work from My work
  const data = await serverApi<StorageData & { space?: SpaceTheme }>(`/api/spaces/${slug}/storage`);
  if (!data?.space) notFound();
  const base = `/spaces/${slug}`;
  const inStore = data.pieces.filter(p => !p.outAt).length;
  return (
    <>
      <header style={pageHeader} className="px-4 sm:px-10 pt-5 pb-6 flex flex-col gap-1.5">
        <div className="text-[13px]" style={muted}><Link href={base} style={{ color: "var(--tws-accent-ink)" }}>{data.space.name}</Link> › Storage</div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: "36px", fontWeight: 800 }}>Set storage</h1>
        <span className="text-sm" style={muted}>Built pieces and where they&apos;ve been put · {inStore} piece{inStore === 1 ? "" : "s"} in store across {data.locations.filter(l => !l.archived).length} location{data.locations.filter(l => !l.archived).length === 1 ? "" : "s"}</span>
      </header>
      <div className="px-4 sm:px-10 pt-6 pb-10">
        <SetStorage slug={slug} base={base} initial={data} />
      </div>
    </>
  );
}
