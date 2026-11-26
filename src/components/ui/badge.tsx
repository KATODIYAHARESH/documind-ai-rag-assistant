import type { ReactNode } from "react";
import { tw } from "@/lib/format";

type Variant = "neutral" | "crimson" | "outline" | "solid";

const VARIANTS: Record<Variant, string> = {
  neutral: "border-white/10 bg-white/[0.06] text-neutral-200",
  crimson: "border-crimson-600/35 bg-crimson-900/35 text-crimson-300",
  outline: "border-white/15 bg-transparent text-neutral-300",
  solid: "border-crimson-700 bg-crimson-800 text-white",
};

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={tw(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5 tracking-wide",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
