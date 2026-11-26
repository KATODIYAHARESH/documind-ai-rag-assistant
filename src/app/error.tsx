"use client";

import { useEffect } from "react";
import { AlertTriangle, LayoutDashboard, RotateCcw } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

/** Global error boundary: an unexpected client or render error never leaves a blank screen. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass w-full max-w-md rounded-3xl p-8 text-center shadow-glass">
        <span className="glass-strong mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-crimson-300">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="mt-5 font-display text-3xl text-white">Something went wrong</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          This screen hit an unexpected error. Your documents and conversations are safe.
        </p>
        {error.digest ? <p className="mt-2 font-mono text-xs text-neutral-600">{error.digest}</p> : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <ButtonLink href="/dashboard" variant="secondary" icon={<LayoutDashboard className="h-4 w-4" />}>
            Go to overview
          </ButtonLink>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-crimson-500/30 bg-linear-to-b from-crimson-600 to-crimson-800 px-5 text-sm font-medium text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
