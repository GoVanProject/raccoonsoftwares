"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
const sheetVariants = cva(
  "fixed z-50 bg-card p-6 text-card-foreground shadow-2xl outline-none transition ease-product data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b",
        bottom: "inset-x-0 bottom-0 border-t",
        left: "inset-y-0 left-0 h-full w-[min(88vw,320px)] border-r",
        right: "inset-y-0 right-0 h-full w-[min(88vw,420px)] border-l",
      },
    },
    defaultVariants: { side: "right" },
  },
);
export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
    VariantProps<typeof sheetVariants>
>(({ side, className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute right-4 top-4 grid size-9 place-items-center rounded-sm hover:bg-muted"
        aria-label="Fechar"
      >
        <X size={18} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;
export const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mb-6 flex flex-col gap-2", className)} {...props} />
);
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;
