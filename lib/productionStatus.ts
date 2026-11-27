// One set of production status and announcement colours and labels, shared by the productions
// list and each production's page (audit round 2: two copies had drifted apart).
export const STATUS_OPTS = ["planning", "in-production", "closed"];
export const STATUS_COLORS: Record<string, string> = {
  planning: "bg-yellow-900/60 text-yellow-300",
  "in-production": "bg-green-900/60 text-green-300",
  closed: "bg-white/10 text-white/40",
};
export const STATUS_LABELS: Record<string, string> = { planning: "Planning", "in-production": "In Production", closed: "Closed" };
export const ANN_COLORS: Record<string, string> = {
  nda: "bg-red-900/60 text-red-300",
  not_announced: "bg-orange-900/60 text-orange-300",
  on_sale: "bg-blue-900/60 text-blue-300",
  open: "bg-green-900/60 text-green-300",
};
export const ANN_LABELS: Record<string, string> = { nda: "NDA", not_announced: "Not Announced", on_sale: "On Sale", open: "Open" };
export const ANN_OPTS = ["nda", "not_announced", "on_sale", "open"];
