// TWS build stages (decided 25 Nov 2026). Workshop jobs move through these in order; won deals
// start at Confirmation, jobs opened by hand at Quote.
export const BUILD_STAGES = [
  { key: "quote", label: "Quote" },
  { key: "confirmation", label: "Confirmation" },
  { key: "technical_design", label: "Technical Design" },
  { key: "build", label: "Build" },
  { key: "finish", label: "Finish" },
  { key: "delivery", label: "Delivery" },
] as const;
export type BuildStage = (typeof BUILD_STAGES)[number]["key"];
export const isBuildStage = (s: unknown): s is BuildStage => BUILD_STAGES.some(x => x.key === s);
export const buildStageLabel = (s: string | null | undefined) => BUILD_STAGES.find(x => x.key === s)?.label ?? "No stage";
export const stageIndex = (s: string | null | undefined) => BUILD_STAGES.findIndex(x => x.key === s);
/** Jobs that go through build stages: workshop work, or anything already given a stage. */
export const usesBuildStages = (j: { jobType: string; stage?: string | null }) => j.jobType === "workshop" || !!j.stage;
/** A colour per stage, for chips and board columns (works on the dark Hub background). */
export const STAGE_COLOR: Record<string, string> = {
  quote: "#94a3b8", confirmation: "#60a5fa", technical_design: "#a78bfa", build: "#f59e0b", finish: "#2dd4bf", delivery: "#34d399",
};
