import { tw } from "@/lib/format";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="dm-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff4545" />
          <stop offset="1" stopColor="#8b0000" />
        </linearGradient>
      </defs>
      <rect x="6" y="2.5" width="20" height="27" rx="4" fill="url(#dm-logo-gradient)" />
      <path
        d="M11 12.5h10M11 16.5h10M11 20.5h5.5"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.95"
      />
      <circle cx="20" cy="20.5" r="2.6" fill="#080808" stroke="#fff" strokeWidth="1.4" />
      <path d="M20 16.9v-1.2M20 25.3v-1.2M23.6 20.5h-1.2M17.6 20.5h-1.2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={tw("inline-flex shrink-0 items-center gap-2.5", className)}>
      <LogoMark className={markClassName ?? "h-8 w-8"} />
      <span className="font-display text-[23px] leading-none tracking-tight text-white">
        DocuMind <span className="italic text-crimson-400">AI</span>
      </span>
    </span>
  );
}
