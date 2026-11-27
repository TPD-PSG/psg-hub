"use client";

// One build in the space's own look: stage band, parts of the build (who, when, planned hours),
// days logged, collection or delivery, drawings and files, and (for those who see money) the
// quote against actual cost. Uses the same APIs as the Hub's job page.
// This file is the shell: state shared across panels, and the layout. Each card is in its own file here.
import { useState } from "react";
import { alertDialog } from "@/components/Dialogs";
import type { SpaceTheme } from "@/lib/spaces";
import type { JobDetail } from "@/app/jobs/[id]/JobView";
import BuildChecklist, { type Check } from "@/components/BuildChecklist";
import BuildDesign, { type JobContactRow, type JobFileRow } from "@/components/BuildDesign";
import DrawingRegister, { type DrawingRow, type Blocker } from "@/components/DrawingRegister";
import Variations, { type VariationRow } from "@/components/Variations";
import SetStorage, { type StorageData } from "@/components/SetStorage";
import FrCertificates, { type CertRow } from "@/components/FrCertificates";
import { card, h2, muted } from "@/lib/twsUi";
import type { PartRow, Option, JobPhoto, JobMaterials } from "./spaceJobTypes";
import JobHeader from "./JobHeader";
import QuoteVsActual from "./QuoteVsActual";
import JobMaterialsPanel from "./JobMaterialsPanel";
import JobPartsPanel from "./JobPartsPanel";
import DaysLoggedPanel from "./DaysLoggedPanel";
import CollectionPanel from "./CollectionPanel";
import BuildPhotosPanel from "./BuildPhotosPanel";
import DrawingsFilesPanel from "./DrawingsFilesPanel";

export type { PartRow, JobPhoto, JobMaterials } from "./spaceJobTypes";

export default function SpaceJob({ space, initial, seeMoney, initialParts, people, productions, me, initialMaterials, initialPhotos, initialChecks, initialContacts, initialFiles, initialDrawings, initialVariations = [], initialStorage = null, initialCerts = [] }: {
  space: SpaceTheme; initial: JobDetail; seeMoney: boolean; initialParts: PartRow[]; people: Option[]; productions: Option[]; me: { id: number; isAdmin: boolean }; initialMaterials: JobMaterials; initialPhotos: JobPhoto[]; initialChecks: Check[]; initialContacts: JobContactRow[]; initialFiles: JobFileRow[]; initialDrawings: { drawings: DrawingRow[]; blockers: Blocker[]; overrides?: { id: number; text: string; createdAt: string }[] };
  initialVariations?: VariationRow[];
  initialStorage?: StorageData | null;
  initialCerts?: CertRow[];
}) {
  const [blockers, setBlockers] = useState(initialDrawings.blockers);
  const [checks, setChecks] = useState(initialChecks);
  const [job, setJob] = useState(initial);
  const [parts, setParts] = useState(initialParts);
  const [busy, setBusy] = useState(false);
  const base = `/spaces/${space.slug}`;

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { await alertDialog(data.error ?? "That didn't work"); return null; }
    return data;
  }
  const reload = async () => { const d = await fetch(`/api/jobs/${job.id}`).then(r => (r.ok ? r.json() : null)).catch(() => null); if (d?.job) setJob(d.job); };

  const f = job.figures;

  return (
    <>
      <JobHeader space={space} base={base} job={job} setJob={setJob} busy={busy} setBusy={setBusy} blockers={blockers} initialContacts={initialContacts} />

      <div className="px-4 sm:px-10 pt-6 pb-10 grid gap-6 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
          {/* Quote vs actual */}
          {seeMoney && f && <QuoteVsActual space={space} jobId={initial.id} job={job} f={f} busy={busy} />}

          {seeMoney && <Variations jobId={job.id} entityId={space.id} isAdmin={me.isAdmin} hasClient={!!job.client} initial={initialVariations} onChange={reload} />}

          {/* Drawings for client sign-off (the build gate) */}
          <DrawingRegister jobId={initial.id} initial={initialDrawings} isAdmin={me.isAdmin} onBlockers={setBlockers} />

          {/* Design & contacts: the designer, drawings and model box */}
          <BuildDesign jobId={initial.id} initialContacts={initialContacts} initialFiles={initialFiles} me={me} />

          {/* Materials & purchase orders */}
          <JobMaterialsPanel space={space} base={base} jobId={job.id} parts={parts} setParts={setParts} initialMaterials={initialMaterials} seeMoney={seeMoney} busy={busy} setBusy={setBusy} call={call} reload={reload} />

          {/* Parts */}
          <JobPartsPanel space={space} base={base} job={job} parts={parts} setParts={setParts} people={people} seeMoney={seeMoney} me={me} busy={busy} call={call} />

          {/* Days logged */}
          <DaysLoggedPanel job={job} me={me} busy={busy} call={call} reload={reload} />
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          {/* Collection / delivery */}
          <CollectionPanel space={space} job={job} setJob={setJob} parts={parts} productions={productions} checks={checks} setChecks={setChecks} busy={busy} call={call} />

          {/* Snags & tasks */}
          <section style={card} className="flex flex-col gap-2.5" aria-label="Snags and tasks">
            <h2 style={h2}>Snags &amp; tasks <span className="text-sm font-medium" style={muted}>{checks.filter(c => c.kind === "snag").length ? `${checks.filter(c => c.kind === "snag" && c.done).length}/${checks.filter(c => c.kind === "snag").length}` : ""}</span></h2>
            <BuildChecklist jobId={job.id} kind="snag" checks={checks} onChange={setChecks} placeholder="e.g. Trial fit of flats before paint" />
          </section>

          {/* Build photos */}
          <BuildPhotosPanel jobId={initial.id} job={job} base={base} me={me} initialPhotos={initialPhotos} />

          <FrCertificates jobId={job.id} initial={initialCerts} />

          {initialStorage && <SetStorage slug={space.slug} base={`/spaces/${space.slug}`} jobId={job.id} initial={initialStorage} />}

          {/* Drawings & files */}
          <DrawingsFilesPanel job={job} base={base} busy={busy} call={call} reload={reload} />
        </div>
      </div>
    </>
  );
}
