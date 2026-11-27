// Coloured status pill used by the Finance invoice and expense tables and panels.

export default function StatusBadge({ status, statuses }: { status: string; statuses: { key: string; label: string; color: string }[] }) {
  const s = statuses.find(x => x.key === status) ?? { label: status, color: "#6b7280" };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: s.color + "22", color: s.color }}>
      {s.label}
    </span>
  );
}
