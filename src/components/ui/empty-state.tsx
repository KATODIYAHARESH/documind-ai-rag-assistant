import type { ReactNode } from "react";
import { tw } from "@/lib/format";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, actions, className }: EmptyStateProps) {
  return (
    <div className={tw("glass flex flex-col items-center rounded-2xl px-6 py-14 text-center", className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-crimson-600/30 blur-2xl" aria-hidden />
        <div className="glass-strong relative flex h-14 w-14 items-center justify-center rounded-2xl text-crimson-300 [&>svg]:h-6 [&>svg]:w-6">
          {icon}
        </div>
      </div>
      <h3 className="font-display text-2xl text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-neutral-400">{description}</p>
      {actions ? <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </div>
  );
}
