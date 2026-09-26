import { motion } from 'framer-motion';
import { motionTokens } from '../../shared/motion/tokens';
import type { EmployerStage } from './useEmployerFlow';

const STAGES: { stage: EmployerStage; label: string }[] = [
  { stage: 'draft', label: 'Draft' },
  { stage: 'Created', label: 'Created' },
  { stage: 'Funded', label: 'Funded' },
  { stage: 'Distributed', label: 'Distributed' },
];

const STAGE_RANK: Record<EmployerStage, number> = {
  draft: 0,
  Created: 1,
  Funded: 2,
  Distributed: 3,
};

export function LifecycleRail({ stage }: { stage: EmployerStage }) {
  const currentRank = STAGE_RANK[stage];

  return (
    <nav aria-label="Lifecycle progress" className="mb-8">
      <ol className="flex flex-wrap items-center gap-2">
        {STAGES.map((s) => {
          const rank = STAGE_RANK[s.stage];
          const isCurrent = s.stage === stage;
          const isCompleted = rank < currentRank;

          return (
            <li key={s.stage} className="relative flex items-center">
              <div
                className={`relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  isCurrent
                    ? 'text-[var(--eclipse-ink)]'
                    : isCompleted
                      ? 'text-[var(--eclipse-ink-on-field)] bg-[var(--eclipse-surface)]/20'
                      : 'text-[var(--eclipse-ink-muted)] bg-transparent border border-white/10'
                }`}
              >
                {isCurrent ? (
                  <motion.span
                    layoutId="lifecycle-active"
                    transition={motionTokens.spring}
                    className="absolute inset-0 rounded-full bg-[var(--eclipse-accent)]"
                  />
                ) : null}
                <span className="relative z-10">{s.label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
