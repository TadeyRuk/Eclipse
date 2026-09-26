import type { LucideIcon } from 'lucide-react';

export function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-[var(--eclipse-surface)] px-4 py-2 text-[var(--eclipse-ink)]">
      <Icon size={16} className="text-[var(--eclipse-ink-muted)]" />
      <span className="display text-base font-semibold">{value}</span>
      <span className="text-xs text-[var(--eclipse-ink-muted)]">{label}</span>
    </div>
  );
}
