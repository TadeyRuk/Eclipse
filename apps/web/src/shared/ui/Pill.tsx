import type { ReactNode } from 'react';

export function Pill({
  children,
  active = false,
  className = '',
}: {
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm ${
        active
          ? 'bg-[var(--eclipse-accent)] text-[var(--eclipse-ink)]'
          : 'text-[var(--eclipse-ink-muted)]'
      } ${className}`}
    >
      {children}
    </span>
  );
}
