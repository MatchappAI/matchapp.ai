import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
  },
};

const reducedItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

type DivProps = HTMLMotionProps<"div">;

export function MotionGridContainer({
  children,
  className,
  ...rest
}: { children: ReactNode } & DivProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function MotionGridItem({
  children,
  className,
  hoverLift = true,
  ...rest
}: { children: ReactNode; hoverLift?: boolean } & DivProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={reduce ? reducedItem : itemVariants}
      whileHover={
        reduce || !hoverLift
          ? undefined
          : { y: -3, transition: { duration: 0.2, ease: "easeOut" } }
      }
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
