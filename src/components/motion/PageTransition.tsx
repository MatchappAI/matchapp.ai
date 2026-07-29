import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  const variants: Variants = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        initial: { opacity: 0 },
        animate: {
          opacity: 1,
          transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1], staggerChildren: 0.06 },
        },
        exit: {
          opacity: 0,
          transition: { duration: 0.18, ease: [0.76, 0, 0.24, 1] },
        },
      };

  return (
    <motion.div variants={variants} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  );
}
