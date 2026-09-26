import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { motionTokens } from '../motion/tokens';

export function Pill({
  children,
  active = false,
  layoutId,
  className = '',
}: {
  children: ReactNode;
  active?: boolean;
  layoutId?: string;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'text-[var(--eclipse-ink)]'
          : 'text-[var(--eclipse-ink-muted)]'
      } ${className}`}
    >
      {active && layoutId ? (
        <motion.span
          layoutId={layoutId}
          transition={motionTokens.spring}
          className="absolute inset-0 rounded-full bg-[var(--eclipse-accent)]"
        />
      ) : active ? (
        <span className="absolute inset-0 rounded-full bg-[var(--eclipse-accent)]" />
      ) : null}
      <span className="relative z-10">{children}</span>
    </span>
  );
}
