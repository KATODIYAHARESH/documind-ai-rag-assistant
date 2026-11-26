"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowDown, Check, FileText, Quote, Send, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";

const EASE = [0.16, 1, 0.3, 1] as const;

const ASSURANCES = ["Source-cited answers", "Genuine RAG retrieval", "Private by design"];

function FloatingDoc({
  className,
  animate,
  name,
  meta,
  style,
}: {
  className: string;
  animate: string;
  name: string;
  meta: string;
  style: CSSProperties;
}) {
  return (
    <div className={`${className} ${animate} pointer-events-none`} style={style} aria-hidden>
      <div className="glass-strong flex h-full w-full flex-col justify-between rounded-xl p-3 shadow-glass">
        <FileText className="h-6 w-6 text-crimson-300" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-white">{name}</p>
          <p className="text-[10px] text-neutral-500">{meta}</p>
        </div>
      </div>
    </div>
  );
}

function HeroVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
      className="relative mx-auto w-full max-w-[540px]"
    >
      <div className="absolute -inset-16 -z-10">
        <Image
          src="/images/hero-visual.jpg"
          alt=""
          fill
          sizes="820px"
          priority
          className="object-cover opacity-80 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_72%)]"
        />
      </div>

      <FloatingDoc
        className="absolute -left-10 top-2 hidden h-44 w-32 sm:block"
        animate="animate-float"
        name="Q3 report.pdf"
        meta="12 pages · indexed"
        style={{ "--float-rotate": "-9deg" } as CSSProperties}
      />
      <FloatingDoc
        className="absolute -right-9 bottom-12 hidden h-40 w-[7rem] sm:block"
        animate="animate-float-delayed"
        name="Handbook.pdf"
        meta="48 pages · indexed"
        style={{ "--float-rotate": "8deg" } as CSSProperties}
      />

      {/* Product preview: the assistant workspace with a cited answer. */}
      <div className="glass-strong relative rounded-3xl p-4 shadow-glass sm:p-5">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
          <LogoMark className="h-6 w-6" />
          <p className="text-sm font-semibold text-white">DocuMind AI</p>
          <span className="ml-auto rounded-full border border-crimson-600/35 bg-crimson-900/35 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-crimson-300">
            KNOWLEDGE BASE · 12 DOCS
          </span>
        </div>

        <div className="pt-4">
          <div className="ml-auto w-fit max-w-[86%] rounded-2xl rounded-br-md border border-crimson-700/40 bg-linear-to-br from-crimson-900/75 to-crimson-950/70 px-3.5 py-2.5 text-sm text-white">
            Which vector database does Atlas use?
          </div>

          <div className="mt-4 flex gap-2.5">
            <span className="glass mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
              <Sparkles className="h-3.5 w-3.5 text-crimson-300" />
            </span>
            <div className="glass min-w-0 flex-1 rounded-2xl rounded-tl-md px-3.5 py-3">
              <p className="text-sm leading-relaxed text-neutral-100">
                Atlas stores its vectors in <strong className="font-semibold text-white">ChromaDB 0.5</strong>, with a persistent storage
                directory mounted on the application server.{" "}
                <span className="mx-0.5 inline-flex -translate-y-px items-center rounded-md border border-crimson-600/40 bg-crimson-900/40 px-1.5 py-px align-baseline text-[11px] font-semibold leading-5 text-crimson-200">
                  [S1]
                </span>
              </p>
            </div>
          </div>

          <div className="glass ml-10 mt-2.5 flex items-center gap-2 rounded-xl px-3 py-2">
            <Quote className="h-3.5 w-3.5 shrink-0 text-crimson-300" />
            <p className="min-w-0 truncate text-xs text-neutral-400">
              <span className="font-semibold text-neutral-200">S1</span> · Atlas Platform — Technical Overview · page 1
            </p>
            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-neutral-500">92% match</span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-ink-950/70 py-1.5 pl-4 pr-1.5">
          <p className="flex-1 truncate text-sm text-neutral-500">Ask anything about your documents…</p>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-b from-crimson-600 to-crimson-800 text-white" aria-hidden>
            <Send className="h-4 w-4" />
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function Hero({ authenticated }: { authenticated: boolean }) {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-crimson-600/35 bg-crimson-900/25 px-3 py-1.5 text-xs font-medium text-crimson-200"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-crimson-400 shadow-[0_0_8px_rgba(255,69,69,0.9)]" />
            AI-powered document intelligence
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
            className="mt-6 font-display text-[52px] leading-[1.02] tracking-[-0.01em] text-white sm:text-7xl lg:text-[84px]"
          >
            Your Documents.
            <br />
            <span className="italic text-gradient-crimson">Your Intelligence.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease: EASE }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-400"
          >
            Transform your documents into an intelligent knowledge base. Ask questions, discover insights, and get accurate answers.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28, ease: EASE }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <ButtonLink href={authenticated ? "/dashboard" : "/signup"} size="lg" icon={<Sparkles className="h-4 w-4" />}>
              Get Started
            </ButtonLink>
            <ButtonLink href="#features" variant="secondary" size="lg" icon={<ArrowDown className="h-4 w-4" />}>
              Explore Features
            </ButtonLink>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-500"
          >
            {ASSURANCES.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-crimson-400" strokeWidth={2.25} />
                {item}
              </li>
            ))}
          </motion.ul>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}
