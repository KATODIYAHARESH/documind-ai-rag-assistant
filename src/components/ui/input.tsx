"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { tw } from "@/lib/format";

const FIELD_BASE =
  "scrollbar-slim w-full rounded-xl border border-white/10 bg-ink-900/80 text-sm text-white transition-colors duration-200 placeholder:text-neutral-500 focus:border-crimson-500/60 focus:outline-none focus:ring-2 focus:ring-crimson-600/20 disabled:cursor-not-allowed disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={tw(FIELD_BASE, "h-11 px-4", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={tw(FIELD_BASE, "min-h-11 resize-none px-4 py-3 leading-relaxed", className)} {...rest} />;
});

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: (id: string) => ReactNode;
  className?: string;
}

/** Labelled form field with helper text and inline validation errors. */
export function Field({ label, hint, error, htmlFor, children, className }: FieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  return (
    <div className={tw("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-neutral-200">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p role="alert" className="text-xs text-crimson-300">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (next: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">{label}</span>
        {description ? <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={tw(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60",
          checked ? "border-crimson-500/50 bg-crimson-800" : "border-white/15 bg-white/[0.08]",
        )}
      >
        <span
          className={tw(
            "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all duration-200",
            checked ? "left-[22px]" : "left-[3px]",
          )}
        />
      </button>
    </label>
  );
}
