import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ShimmerButton } from "@/components/ui/shimmer-button";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold text-white transition-all duration-300 ease-product focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/30 text-primary-foreground hover:brightness-95",
        destructive:
          "border-destructive/30 text-destructive-foreground hover:brightness-95",
        outline: "border-border text-foreground hover:border-primary/40",
        secondary: "border-secondary text-secondary-foreground hover:brightness-95",
        ghost: "border-transparent text-foreground hover:bg-muted/70",
        link: "border-transparent bg-transparent px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    const resolvedVariant = variant ?? "default";
    const backgrounds = {
      default: "hsl(var(--primary))",
      destructive: "hsl(var(--destructive))",
      outline: "hsl(var(--card))",
      secondary: "hsl(var(--secondary))",
      ghost: "transparent",
      link: "transparent",
    } as const;

    return (
    <ShimmerButton
      ref={ref}
      borderRadius="0.375rem"
      shimmerColor={
        resolvedVariant === "ghost" || resolvedVariant === "link"
          ? "hsl(var(--primary) / 0.25)"
          : "hsl(var(--primary-foreground) / 0.55)"
      }
      shimmerSize="0.035em"
      shimmerDuration="4s"
      background={backgrounds[resolvedVariant]}
      className={cn(buttonVariants({ variant: resolvedVariant, size }), className)}
      {...props}
    />
    );
  },
);
Button.displayName = "Button";
export { buttonVariants };
