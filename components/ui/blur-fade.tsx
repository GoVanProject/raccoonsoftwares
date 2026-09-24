"use client";
import { useRef } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  type MotionProps,
  type UseInViewOptions,
  type Variants,
} from "motion/react";
type MarginType = UseInViewOptions["margin"];
interface BlurFadeProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
  variant?: { hidden: { y: number }; visible: { y: number } };
  duration?: number;
  delay?: number;
  offset?: number;
  direction?: "up" | "down" | "left" | "right";
  inView?: boolean;
  inViewMargin?: MarginType;
  blur?: string;
}
export function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  offset = 6,
  direction = "down",
  inView = false,
  inViewMargin = "-50px",
  blur = "6px",
  ...props
}: BlurFadeProps) {
  const ref = useRef(null);
  const visible = useInView(ref, { once: true, margin: inViewMargin });
  const reduced = useReducedMotion();
  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const variants: Variants = variant ?? {
    hidden: {
      [axis]: direction === "right" || direction === "down" ? -offset : offset,
      opacity: 0,
      filter: `blur(${blur})`,
    },
    visible: { [axis]: 0, opacity: 1, filter: "blur(0px)" },
  };
  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={reduced ? "visible" : "hidden"}
        animate={!inView || visible ? "visible" : "hidden"}
        exit="hidden"
        variants={variants}
        transition={{
          delay: reduced ? 0 : 0.04 + delay,
          duration: reduced ? 0 : duration,
          ease: [0.32, 0.72, 0, 1],
        }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
