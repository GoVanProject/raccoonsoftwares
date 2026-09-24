import React, {
  type ComponentPropsWithoutRef,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/utils";
export interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}
export const ShimmerButton = React.forwardRef<
  HTMLButtonElement,
  ShimmerButtonProps
>(
  (
    {
      shimmerColor = "#ffffff",
      shimmerSize = "0.05em",
      shimmerDuration = "3s",
      borderRadius = "100px",
      background = "rgba(0,0,0,1)",
      className,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      style={
        {
          "--spread": "90deg",
          "--shimmer-color": shimmerColor,
          "--radius": borderRadius,
          "--speed": shimmerDuration,
          "--cut": shimmerSize,
          "--bg": background,
        } as CSSProperties
      }
      className={cn(
        "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap rounded-[var(--radius)] border border-white/10 bg-[var(--bg)] px-6 py-3 text-white transition-transform duration-300 ease-product active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      ref={ref}
      {...props}
    >
      <div className="absolute inset-0 -z-30 overflow-visible blur-[2px] [container-type:size]">
        <div className="absolute inset-0 h-[100cqh] aspect-square animate-shimmer-slide">
          <div className="absolute -inset-full w-auto animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
        </div>
      </div>
      {children}
      <div className="pointer-events-none absolute inset-0 size-full rounded-2xl shadow-[inset_0_-8px_10px_#ffffff1f] transition-all duration-300 group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]" />
      <div className="absolute -z-20 rounded-[var(--radius)] bg-[var(--bg)] [inset:var(--cut)]" />
    </button>
  ),
);
ShimmerButton.displayName = "ShimmerButton";
