"use client";
import { cn } from "@/lib/utils";
export interface ProgressiveBlurProps {
  className?: string;
  height?: string;
  position?: "top" | "bottom" | "both";
  blurLevels?: number[];
}
export function ProgressiveBlur({
  className,
  height = "30%",
  position = "bottom",
  blurLevels = [0.5, 1, 2, 4, 8, 16, 32, 64],
}: ProgressiveBlurProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10",
        position === "top"
          ? "top-0"
          : position === "bottom"
            ? "bottom-0"
            : "inset-y-0",
        className,
      )}
      style={{ height: position === "both" ? "100%" : height }}
    >
      {blurLevels.map((level, index) => {
        const start = index * (100 / blurLevels.length);
        const end = (index + 2) * (100 / blurLevels.length);
        const direction = position === "top" ? "to top" : "to bottom";
        const maskImage =
          position === "both"
            ? "linear-gradient(transparent 0%, black 10%, black 90%, transparent 100%)"
            : `linear-gradient(${direction}, transparent ${start}%, black ${start + 100 / blurLevels.length}%, transparent ${end}%)`;
        return (
          <div
            key={level}
            className="absolute inset-0"
            style={{
              backdropFilter: `blur(${level}px)`,
              WebkitBackdropFilter: `blur(${level}px)`,
              maskImage,
              WebkitMaskImage: maskImage,
            }}
          />
        );
      })}
    </div>
  );
}
