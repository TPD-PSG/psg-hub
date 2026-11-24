// What the entities API returns for each entity (with its yearly targets)
export const ENTITY_SELECT = {
  id: true, name: true, archived: true, sortOrder: true,
  targets: { select: { year: true, amount: true }, orderBy: { year: "asc" as const } },
};
export type EntityRow = { id: number; name: string; archived: boolean; sortOrder: number; targets: { year: number; amount: number }[] };
