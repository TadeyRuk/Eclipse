import { motion, useReducedMotion } from 'framer-motion';
import { MAX_RECIPIENTS } from '@eclipse/sdk';
import { Card } from '../../shared/ui';

export type ProofChamberState = 'idle' | 'proving' | 'success' | 'error';

export function ProofChamber({
  recipientCount,
  state,
}: {
  recipientCount: number;
  state: ProofChamberState;
}) {
  const shouldReduceMotion = useReducedMotion();
  const slots = Array.from({ length: MAX_RECIPIENTS }, (_, i) => i);

  return (
    <Card
      testId="proof-chamber"
      dataState={state}
      className={`relative overflow-hidden transition-all duration-300 ${
        state === 'success'
          ? 'border-2 border-[var(--eclipse-accent)] shadow-[0_0_24px_rgba(217,255,75,0.25)]'
          : state === 'error'
            ? 'border-2 border-[var(--eclipse-danger)]'
            : 'border border-black/5'
      }`}
    >
      <div
        data-state={state}
        className="flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="relative mb-6 flex h-40 w-40 items-center justify-center">
          {/* Central eclipse halo */}
          <motion.div
            className={`absolute h-20 w-20 rounded-full transition-colors ${
              state === 'proving'
                ? 'bg-[var(--eclipse-accent)]/30 blur-md'
                : state === 'success'
                  ? 'bg-[var(--eclipse-accent)]'
                  : 'bg-[var(--eclipse-tag-bg)]'
            }`}
            animate={
              shouldReduceMotion
                ? undefined
                : state === 'proving'
                  ? { scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }
                  : state === 'success'
                    ? { scale: [1, 1.12, 1], opacity: 1 }
                    : { scale: 1, opacity: 0.8 }
            }
            transition={
              state === 'proving'
                ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                : state === 'success'
                  ? { duration: 0.6, ease: 'easeInOut' }
                  : { duration: 0.3, ease: 'easeOut' }
            }
          />

          {/* Central core circle */}
          <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--eclipse-field-end)] text-xs font-semibold text-[var(--eclipse-ink-on-field)]">
            {state === 'proving'
              ? 'ZK'
              : state === 'success'
                ? '✓'
                : state === 'error'
                  ? '!'
                  : 'SUM'}
          </div>

          {/* 8 fixed slot marks surrounding the ring */}
          {slots.map((i) => {
            const angle = (i * 2 * Math.PI) / MAX_RECIPIENTS;
            const radius = 64;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const isActive = i < recipientCount;

            return (
              <motion.div
                key={i}
                className={`absolute h-4 w-4 rounded-full transition-colors ${
                  isActive
                    ? state === 'proving' || state === 'success'
                      ? 'bg-[var(--eclipse-accent)]'
                      : 'bg-[var(--eclipse-field-start)]'
                    : 'border border-black/10 bg-black/5'
                }`}
                style={{ x, y }}
                animate={
                  shouldReduceMotion
                    ? undefined
                    : state === 'proving' && isActive
                      ? {
                          x: [x, x * 0.45, x],
                          y: [y, y * 0.45, y],
                          scale: [1, 1.2, 1],
                        }
                      : { x, y, scale: 1 }
                }
                transition={
                  state === 'proving' && isActive
                    ? {
                        duration: 1.8,
                        repeat: Infinity,
                        delay: i * 0.12,
                        ease: 'easeInOut',
                      }
                    : { duration: 0.3, ease: 'easeOut' }
                }
              />
            );
          })}
        </div>

        <div className="max-w-xs space-y-1">
          <p className="text-sm font-semibold text-[var(--eclipse-ink)]">
            Private amounts stay on this device.
          </p>
          <p className="text-xs text-[var(--eclipse-ink-muted-on-surface)]">
            A zero-knowledge proof binds their sum to the public deposit.
          </p>
          <p className="text-xs text-[var(--eclipse-ink-muted-on-surface)]">
            Only the proof and opaque commitments reach the ledger.
          </p>
        </div>
      </div>
    </Card>
  );
}
