"use client";
import { useCallback, useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import {
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { cn } from "@/lib/utils";
interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  startValue?: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
}
export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(direction === "down" ? value : startValue);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const visible = useInView(ref, { once: true });
  const format = useCallback(
    (number: number) =>
      Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(number),
    [decimalPlaces],
  );
  useEffect(() => {
    if (reduced) {
      if (ref.current) ref.current.textContent = format(value);
      return;
    }
    if (!visible) return;
    const timer = setTimeout(
      () => motionValue.set(direction === "down" ? startValue : value),
      delay * 1000,
    );
    return () => clearTimeout(timer);
  }, [delay, direction, format, motionValue, reduced, startValue, value, visible]);
  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current)
          ref.current.textContent = format(
            Number(latest.toFixed(decimalPlaces)),
          );
      }),
    [decimalPlaces, format, springValue],
  );
  return (
    <span
      ref={ref}
      className={cn("inline-block tabular-nums", className)}
      {...props}
    >
      {reduced ? format(value) : format(startValue)}
    </span>
  );
}
