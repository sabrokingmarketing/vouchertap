import type { ComponentType, ReactNode } from "react";
import { useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/**
 * Shared presentational building blocks for the admin create/edit popups so
 * Events, Breakfast, Vouchers and Shop all share one consistent, modern layout.
 * These are layout-only — no business logic lives here.
 */

const SIZES = {
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-2xl lg:max-w-3xl",
} as const;

/**
 * The admin popup shell: one frosted header, one scrolling body, one sticky
 * footer. On phones it docks to the bottom like a sheet; on desktop it's a
 * centred card. Every admin popup goes through here so they can't drift apart.
 */
export function AdminModal({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  icon: Icon,
  size = "lg",
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  size?: keyof typeof SIZES;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className={cn(
          "flex max-h-[92dvh] w-full flex-col gap-0 overflow-hidden border-0 p-0 shadow-2xl shadow-black/25",
          // Phone: full-width sheet anchored to the bottom edge.
          "max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[1.75rem]",
          "rounded-[1.75rem]",
          SIZES[size],
        )}
      >
        <DialogHeader className="relative shrink-0 space-y-0 border-b border-border/60 bg-background/80 px-6 py-5 text-left backdrop-blur-xl md:px-8">
          {/* Grab handle — reads as a sheet on touch, invisible on desktop */}
          <div
            aria-hidden
            className="absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-border sm:hidden"
          />
          <div className="flex items-start gap-3.5 pr-10 max-sm:pt-2">
            {Icon && (
              <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                  {eyebrow}
                </p>
              )}
              <DialogTitle
                className="mt-0.5 text-[1.375rem] leading-tight tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="mt-1 text-[13px] leading-relaxed">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="slk-close absolute right-4 top-4 max-sm:top-5"
          >
            <X className="size-4.5" />
          </button>
        </DialogHeader>

        {children}

        {footer}
      </DialogContent>
    </Dialog>
  );
}

/** Scrollable popup body. Use directly inside <AdminModal>.
 *  The `slk-form` class activates the Apple-style filled fields (styles.css). */
export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "slk-form slk-scroll flex-1 overflow-y-auto px-6 py-7 md:px-8",
        "divide-y divide-border/60 [&>section]:py-7 [&>section:first-child]:pt-0 [&>section:last-child]:pb-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A titled group of fields. */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {title && (
        <div className="space-y-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </h3>
          {description && (
            <p className="text-[12px] leading-relaxed text-muted-foreground/80">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/** A single labelled field with optional required marker and helper hint. */
export function Field({
  label,
  hint,
  required,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  hint?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} className="flex items-center gap-1">
          {label}
          {required && (
            <span className="text-primary" aria-hidden>
              *
            </span>
          )}
        </Label>
      )}
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Two-column wrapper for side-by-side fields. */
export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 md:grid-cols-2", className)}>{children}</div>;
}

/** A neutral inset panel for grouping a sub-block (a logo + its name, say). */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-muted/30 p-4", className)}>
      {children}
    </div>
  );
}

/** A paired date + time picker (the pattern repeated across events/breakfast/vouchers). */
export function DateTimeField({
  label,
  required,
  hint,
  dateValue,
  timeValue,
  onDate,
  onTime,
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  dateValue: string;
  timeValue: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
}) {
  return (
    <Field label={label} required={required} hint={hint}>
      <div className="grid grid-cols-[1.35fr_1fr] gap-2">
        <Input
          type="date"
          aria-label={`${label} — date`}
          value={dateValue}
          onChange={(e) => onDate(e.target.value)}
        />
        <Input
          type="time"
          aria-label={`${label} — time`}
          value={timeValue}
          onChange={(e) => onTime(e.target.value)}
        />
      </div>
    </Field>
  );
}

/** An iOS-style setting row: label/description left, control right. */
export function ToggleRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-muted/40 px-4 py-3.5 transition-colors hover:bg-muted/60">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {description && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** A short callout for "this will notify everyone"-type context. */
export function InfoNote({
  icon: Icon,
  children,
}: {
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-primary/[0.06] px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
      {Icon && <Icon className="mt-px size-3.5 shrink-0 text-primary" />}
      <span>{children}</span>
    </p>
  );
}

/**
 * Comma-separated list edited as removable chips. Reads and writes the same
 * "Black, White, Red" string the database already stores, so nothing behind it
 * has to change — it's only nicer to use.
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  function commit(raw: string) {
    const next = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((t) => !tags.some((e) => e.toLowerCase() === t.toLowerCase()));
    if (next.length) onChange([...tags, ...next].join(", "));
    setDraft("");
  }

  function removeAt(i: number) {
    onChange(tags.filter((_, j) => j !== i).join(", "));
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.focus()}
        className="slk-tagbox flex min-h-11 flex-wrap items-center gap-1.5 px-2 py-1.5"
      >
        {tags.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-[12px] font-medium shadow-sm ring-1 ring-border/70"
          >
            {t}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeAt(i);
              }}
              aria-label={`Remove ${t}`}
              className="-mr-0.5 grid size-4 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          placeholder={tags.length === 0 ? placeholder : "Add another…"}
          onChange={(e) => {
            // Typing a comma is how people naturally end an item — accept it.
            if (e.target.value.includes(",")) commit(e.target.value);
            else setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && draft === "" && tags.length) {
              removeAt(tags.length - 1);
            }
          }}
          onBlur={() => commit(draft)}
          className="slk-bare min-w-28 flex-1 bg-transparent px-1.5 text-sm outline-none"
        />
      </div>
      {suggestions &&
        suggestions.some((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase())) && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions
              .filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()))
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => commit(s)}
                  className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  + {s}
                </button>
              ))}
          </div>
        )}
    </div>
  );
}

/** Standardised frosted sticky footer: optional hint left, Cancel + pill Save right. */
export function ModalFooter({
  hint,
  onCancel,
  onSave,
  saving,
  saveLabel,
}: {
  hint?: ReactNode;
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  saveLabel: string;
}) {
  return (
    <DialogFooter className="shrink-0 items-center gap-3 border-t border-border/60 bg-background/85 px-6 py-4 backdrop-blur-xl md:px-8 sm:justify-between sm:items-center max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
      {hint ? (
        <p className="hidden text-[11px] leading-snug text-muted-foreground sm:block">{hint}</p>
      ) : (
        <span className="hidden sm:block" />
      )}
      <div className="flex justify-end gap-2 max-sm:w-full">
        <Button
          variant="ghost"
          onClick={onCancel}
          className="h-11 rounded-full px-5 text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Button>
        <Button
          onClick={onSave}
          disabled={saving}
          className="h-11 rounded-full px-8 font-semibold shadow-lg shadow-primary/25 transition-shadow hover:shadow-primary/35 max-sm:flex-1"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : saveLabel}
        </Button>
      </div>
    </DialogFooter>
  );
}

/** One consistent destructive confirmation across every admin screen. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  loading,
  icon: Icon,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center sm:items-start sm:text-left">
          {Icon && (
            <span className="mb-1 grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive">
              <Icon className="size-5" />
            </span>
          )}
          <AlertDialogTitle
            className="text-xl tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="leading-relaxed">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            className="bg-destructive text-destructive-foreground shadow-lg shadow-destructive/25 hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
