// Build checklists (TWS build page): snags and tasks, and ready-to-collect checks.
export const CHECK_KINDS = ["snag", "collect"] as const;
/** The standard ready-to-collect checks, added in one click (25 Nov 2026 defaults; edit per build). */
export const STANDARD_COLLECT_CHECKS = [
  "Trial fit done",
  "Flame-retardant certificates in the pack",
  "Photos taken for the showcase",
  "Labelled and wrapped for transport",
  "Haulier and loading slot confirmed",
];
export const CHECK_SELECT = { id: true, kind: true, text: true, done: true, doneAt: true, sortOrder: true, doneBy: { select: { name: true } } } as const;
