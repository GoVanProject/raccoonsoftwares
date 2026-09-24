"use client";
import * as React from "react";
import {
  CheckCircle,
  Info,
  WarningCircle,
  UploadSimple,
} from "@phosphor-icons/react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShimmerButton,
  type ShimmerButtonProps,
} from "@/components/ui/shimmer-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type WorkspaceSection =
  "projects" | "board" | "team" | "prospects" | "room" | "profile";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("workspace-v2-page-header", className)}>
      <div>
        {eyebrow ? <p>{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <span>{description}</span> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
export function PrimaryAction({
  children,
  shimmer = false,
  ...props
}: (ButtonProps | ShimmerButtonProps) & { shimmer?: boolean }) {
  if (shimmer)
    return (
      <ShimmerButton
        borderRadius="10px"
        background="hsl(var(--primary))"
        {...(props as ShimmerButtonProps)}
      >
        {children}
      </ShimmerButton>
    );
  return <Button {...(props as ButtonProps)}>{children}</Button>;
}
export function StatusBanner({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "success" | "error";
}) {
  const Icon =
    tone === "success" ? CheckCircle : tone === "error" ? WarningCircle : Info;
  return (
    <div
      className={cn("workspace-v2-status", `is-${tone}`)}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon size={18} weight="fill" />
      <span>{children}</span>
    </div>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="workspace-v2-empty">
      {icon}
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="workspace-v2-loading" role="status" aria-label="Carregando">
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton className="h-20 w-full" key={index} />
      ))}
    </div>
  );
}
export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="workspace-v2-field">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? <small>{hint}</small> : null}
      {error ? (
        <small className="is-error" role="alert">
          {error}
        </small>
      ) : null}
    </div>
  );
}
export const UploadField = React.forwardRef<
  HTMLInputElement,
  {
    id: string;
    label: string;
    hint?: string;
    accept?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
  }
>(({ id, label, hint, accept, onChange }, ref) => (
  <div className="workspace-v2-upload">
    <UploadSimple size={22} />
    <div>
      <Label htmlFor={id}>{label}</Label>
      {hint ? <small>{hint}</small> : null}
    </div>
    <Input ref={ref} id={id} type="file" accept={accept} onChange={onChange} />
  </div>
));
UploadField.displayName = "UploadField";
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  destructive = false,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant={destructive ? "destructive" : "default"}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
