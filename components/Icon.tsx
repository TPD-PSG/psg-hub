// The New look's icons (build brief stage 1): one line-icon set (Lucide), 18 px, 2 px stroke, in
// the accent or muted colour. Replaces the emoji as pages move to the new look. Decorative by
// default (hidden from screen readers); pass `label` when the icon is the only thing saying what
// a button does.
import type { LucideIcon } from "lucide-react";

export default function Icon({ icon: I, size = 18, muted = false, label, className }: { icon: LucideIcon; size?: number; muted?: boolean; label?: string; className?: string }) {
  return (
    <I size={size} strokeWidth={2} absoluteStrokeWidth className={className}
      style={{ color: muted ? "var(--nl-text-muted, currentColor)" : "var(--nl-accent, currentColor)", flexShrink: 0 }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} />
  );
}
