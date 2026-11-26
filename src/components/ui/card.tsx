import type { HTMLAttributes, ReactNode } from "react";
import { tw } from "@/lib/format";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function GlassCard({ className, hover = false, children, ...rest }: GlassCardProps) {
  return (
    <div
      className={tw(
        "glass rounded-2xl shadow-glass",
        hover &&
          "transition-all duration-300 hover:-translate-y-0.5 hover:border-crimson-600/40 hover:bg-white/[0.05] hover:shadow-crimson",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Small uppercase label used for eyebrows and section metadata. */
export function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p className={tw("text-[11px] font-semibold uppercase tracking-[0.2em] text-crimson-400", className)}>{children}</p>
  );
}

/** Thin divider that follows the design token set. */
export function Divider({ className }: { className?: string }) {
  return <div className={tw("h-px w-full bg-ink-600", className)} />;
}
