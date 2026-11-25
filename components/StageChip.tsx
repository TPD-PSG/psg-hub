// A build's stage as a small coloured label
import { buildStageLabel, STAGE_COLOR } from "@/lib/buildStages";

export default function StageChip({ stage }: { stage: string | null | undefined }) {
  if (!stage) return null;
  const c = STAGE_COLOR[stage] ?? "#94a3b8";
  return (
    <span className="inline-block text-[11px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap" style={{ color: c, backgroundColor: `${c}22`, border: `1px solid ${c}55` }}>
      {buildStageLabel(stage)}
    </span>
  );
}
