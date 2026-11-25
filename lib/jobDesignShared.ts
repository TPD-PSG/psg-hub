// Contact roles on a build (safe to import in the browser)
export const CONTACT_ROLES = [
  { key: "designer", label: "Set designer" },
  { key: "assistant_designer", label: "Assistant designer" },
  { key: "production_manager", label: "Production manager" },
  { key: "client", label: "Client contact" },
  { key: "venue", label: "Venue contact" },
  { key: "haulier", label: "Haulier" },
  { key: "other", label: "Other" },
] as const;
export const contactRoleLabel = (k: string) => CONTACT_ROLES.find(r => r.key === k)?.label ?? "Contact";
