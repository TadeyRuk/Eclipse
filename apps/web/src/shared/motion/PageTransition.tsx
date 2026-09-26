import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { motionTokens } from './tokens';

export function PageTransition({ children }: { children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: motionTokens.reduced.duration }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.98,
        clipPath: 'circle(15% at 50% 50%)',
      }}
      animate={{
        opacity: 1,
        scale: 1,
        clipPath: 'circle(150% at 50% 50%)',
      }}
      exit={{
        opacity: 0,
        scale: 0.98,
        clipPath: 'circle(15% at 50% 50%)',
      }}
      transition={{
        duration: motionTokens.route.duration,
        ease: motionTokens.route.ease,
      }}
    >
      {children}
    </motion.div>
  );
}
