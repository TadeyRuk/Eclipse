import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { motionTokens } from '../motion/tokens';

const VARIANT_CLASSES = {
  primary: 'bg-[var(--eclipse-accent)] text-[var(--eclipse-ink)]',
  secondary:
    'border border-[var(--eclipse-ink-muted)] bg-transparent text-[var(--eclipse-ink-on-field)]',
} as const;

export function Button({
  children,
  variant = 'primary',
  testId,
  disabled = false,
  busy = false,
  type = 'button',
  onClick,
}: {
  children: ReactNode;
  variant?: keyof typeof VARIANT_CLASSES;
  testId?: string;
  disabled?: boolean;
  busy?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      data-testid={testId}
      type={type}
      disabled={disabled}
      aria-busy={busy || undefined}
      onClick={onClick}
      whileTap={
        disabled || shouldReduceMotion
          ? undefined
          : { scale: 0.97, transition: motionTokens.spring }
      }
      className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-40 ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </motion.button>
  );
}
