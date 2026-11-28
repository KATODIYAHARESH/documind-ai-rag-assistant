import type { ReactNode } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { readSessionToken } from "@/lib/auth";
import { Ambient } from "@/components/ambient";
import { Logo } from "@/components/ui/logo";
import { Eyebrow } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const POINTS = [
  "Every answer cites its document and page",
  "Real retrieval — no invented references",
  "Scanned PDFs are flagged, never silently empty",
  "Your documents stay in your workspace",
];

/** Signed-in users skip auth pages; the split layout keeps the brand present. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const token = await readSessionToken();
  if (token) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen">
      <Ambient intensity="strong" />
      <div className="relative z-10 flex w-full items-center justify-center px-4 py-10 sm:px-8 lg:w-[46%] lg:px-12 xl:px-20">
        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <Logo markClassName="h-9 w-9" />
          </div>
          {children}
        </div>
      </div>

      <aside className="relative hidden flex-1 overflow-hidden border-l border-white/10 lg:block">
        <Image
          src="/images/hero-visual.jpg"
          alt=""
          fill
          sizes="(max-width: 1024px) 0px, 54vw"
          className="object-cover opacity-80"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-r from-ink-950 via-ink-950/55 to-ink-950/10" />
        <div className="bg-noise absolute inset-0" />
        <div className="relative flex h-full max-w-xl flex-col justify-between p-12 xl:p-16">
          <Eyebrow>Your documents, understood</Eyebrow>
          <div>
            <h2 className="font-display text-4xl leading-[1.1] text-white xl:text-5xl">
              Ask questions. <span className="italic text-crimson-300">Trace every answer</span> to its page.
            </h2>
            <ul className="mt-8 flex flex-col gap-3">
              {POINTS.map((point) => (
                <li key={point} className="flex items-center gap-3 text-sm text-neutral-300">
                  <span className="glass flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-crimson-300">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Your Documents. Your Intelligence.</p>
        </div>
      </aside>
    </div>
  );
}
