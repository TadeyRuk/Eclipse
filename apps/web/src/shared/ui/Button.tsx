import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

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
  type = 'button',
  onClick,
}: {
  children: ReactNode;
  variant?: keyof typeof VARIANT_CLASSES;
  testId?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
}) {
  return (
    <motion.button
      data-testid={testId}
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-40 ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </motion.button>
  );
}
