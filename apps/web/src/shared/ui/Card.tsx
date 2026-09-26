import type { HTMLAttributes, ReactNode } from 'react';

export function Card({
  children,
  className = '',
  testId,
  dataState,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
  dataState?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-testid={testId}
      data-state={dataState ?? (rest as Record<string, string | undefined>)['data-state']}
      {...rest}
      className={`rounded-2xl bg-[var(--eclipse-surface)] p-4 text-[var(--eclipse-ink)] shadow-lg shadow-black/20 ${className}`}
    >
      {children}
    </div>
  );
}
