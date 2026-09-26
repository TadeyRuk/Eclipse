import type { ReactNode } from 'react';

export function GradientField({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto min-h-screen max-w-3xl px-5 pb-16 pt-8">{children}</div>
    </div>
  );
}
