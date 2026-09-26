import type { ReactNode } from 'react';

const TONE_CLASSES = {
  default: 'bg-[var(--eclipse-tag-bg)] text-[var(--eclipse-tag-ink)]',
  accent: 'bg-[var(--eclipse-accent)] text-[var(--eclipse-ink)]',
  danger: 'bg-[var(--eclipse-danger)] text-[var(--eclipse-ink-on-field)]',
} as const;

export function Tag({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
