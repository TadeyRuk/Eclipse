import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={`rounded-2xl bg-[var(--eclipse-surface)] p-4 text-[var(--eclipse-ink)] shadow-lg shadow-black/20 ${className}`}
    >
      {children}
    </div>
  );
}
