import { tw } from "@/lib/format";

/** Fixed ambient lighting layer: crimson haze over pure black with a faint grain. */
export function Ambient({ className, intensity = "normal" }: { className?: string; intensity?: "normal" | "strong" }) {
  return (
    <div aria-hidden className={tw("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-ink-950" />
      <div
        className={tw(
          "absolute -top-56 left-1/2 h-[560px] w-[980px] -translate-x-1/2 rounded-full blur-[150px]",
          intensity === "strong" ? "bg-crimson-700/35" : "bg-crimson-800/25",
        )}
      />
      <div className="absolute -left-40 top-1/2 h-[380px] w-[380px] rounded-full bg-crimson-900/20 blur-[130px]" />
      <div className="absolute -right-48 bottom-0 h-[420px] w-[420px] rounded-full bg-crimson-900/15 blur-[140px]" />
      <div className="bg-noise absolute inset-0" />
    </div>
  );
}
