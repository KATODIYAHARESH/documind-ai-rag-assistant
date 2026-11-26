"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Braces,
  Database,
  FileText,
  Fingerprint,
  Layers,
  Lock,
  MessagesSquare,
  Network,
  Quote,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Split,
  type LucideIcon,
} from "lucide-react";
import { tw } from "@/lib/format";
import { GlassCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: ReactNode; description: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-crimson-400">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl leading-[1.08] text-white sm:text-5xl">{title}</h2>
      <p className="mt-4 text-[15px] leading-relaxed text-neutral-400">{description}</p>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

const STEPS: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: FileText,
    title: "Upload",
    description:
      "Drop in PDFs. Each file is validated on the server, its text is extracted page by page, and the page number is kept with every passage.",
  },
  {
    icon: Layers,
    title: "Understand",
    description:
      "Text is split into ~500-token chunks with a 100-token overlap, embedded, and stored as vectors with document, page and chunk metadata.",
  },
  {
    icon: Sparkles,
    title: "Ask",
    description:
      "Your question is embedded, the most relevant passages are retrieved, and the answer is built strictly from them — cited to the page.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              From PDF to <span className="italic text-crimson-300">answered question</span>
            </>
          }
          description="A genuine retrieval-augmented generation pipeline runs on every document you add — nothing about the process is simulated."
        />
        <div className="relative mt-14 grid gap-5 md:grid-cols-3">
          <div className="absolute left-[16%] right-[16%] top-[52px] hidden h-px bg-linear-to-r from-transparent via-crimson-700/60 to-transparent md:block" aria-hidden />
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} delay={index * 0.1}>
                <GlassCard hover className="relative h-full p-6">
                  <div className="flex items-center justify-between">
                    <span className="glass-strong relative flex h-12 w-12 items-center justify-center rounded-2xl text-crimson-300">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className="font-display text-3xl italic text-neutral-700">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">{step.description}</p>
                  {index < STEPS.length - 1 ? (
                    <ArrowRight className="absolute -right-[18px] top-[46px] hidden h-4 w-4 text-crimson-500 md:block" aria-hidden />
                  ) : null}
                </GlassCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

const FEATURES: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: Quote,
    title: "Source-cited answers",
    description: "Every answer is built from retrieved passages and cites the exact document and page so you can verify it in one click.",
  },
  {
    icon: ShieldCheck,
    title: "Grounded, or honest",
    description: "If nothing relevant is retrieved, DocuMind says the information could not be found instead of filling gaps with model memory.",
  },
  {
    icon: Layers,
    title: "Multi-document knowledge",
    description: "Search across your whole library or restrict retrieval to a selected set of documents for focused answers.",
  },
  {
    icon: ScanSearch,
    title: "Page-level tracing",
    description: "Open the original PDF at the page a passage came from, with the matched excerpt and its retrieval score.",
  },
  {
    icon: MessagesSquare,
    title: "Conversational memory",
    description: "Ask follow-up questions with context, regenerate answers, and revisit any saved conversation with its sources intact.",
  },
  {
    icon: Fingerprint,
    title: "Private by design",
    description: "Per-user access control, scrypt-hashed passwords, httpOnly sessions and API keys that never reach the browser.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Powerful features"
          title={
            <>
              Everything you need to <span className="italic text-crimson-300">know what you know</span>
            </>
          }
          description="Built for people who need answers they can trust — and prove."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.title} delay={(index % 3) * 0.08}>
                <GlassCard hover className="h-full p-6">
                  <span className="glass flex h-11 w-11 items-center justify-center rounded-xl text-crimson-300">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">{feature.description}</p>
                </GlassCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* RAG technology                                                      */
/* ------------------------------------------------------------------ */

const PIPELINE = [
  { icon: FileText, title: "Extract", detail: "Page-by-page text extraction with PyMuPDF-grade parsing (pdf.js)." },
  { icon: Split, title: "Chunk", detail: "~500-token passages with a 100-token overlap, never crossing a page." },
  { icon: Network, title: "Embed", detail: "Each chunk becomes a vector carrying its document, page and chunk id." },
  { icon: Database, title: "Retrieve", detail: "Cosine search over candidates, a relevance threshold, and per-document diversity." },
  { icon: Sparkles, title: "Generate", detail: "A strict system prompt turns only the retrieved passages into a cited answer." },
];

export function RagSection() {
  return (
    <section id="technology" className="scroll-mt-24 overflow-hidden py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2">
        <Reveal className="relative order-2 lg:order-1">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 shadow-glass">
            <Image src="/images/rag-visual.jpg" alt="Abstract visualisation of a retrieval pipeline" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-ink-950 via-transparent to-transparent" />
            <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-2">
              {["Top-5 passages", "500 / 100 tokens", "Cosine + lexical", "Threshold-gated"].map((chip) => (
                <Badge key={chip} variant="crimson" className="bg-ink-950/70">
                  {chip}
                </Badge>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="order-1 lg:order-2">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-crimson-400">RAG technology</p>
            <h2 className="mt-3 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
              Answers you can <span className="italic text-crimson-300">trace back to the page</span>.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-neutral-400">
              DocuMind uses retrieval-augmented generation: the model never answers from memory. It receives only the passages your
              documents contributed — and says so when there are none.
            </p>
          </Reveal>
          <ol className="mt-8 flex flex-col">
            {PIPELINE.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <Reveal key={stage.title} delay={index * 0.07}>
                  <li className="group flex gap-4 py-3">
                    <div className="flex flex-col items-center">
                      <span className="glass flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-crimson-300 transition group-hover:shadow-crimson">
                        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                      </span>
                      {index < PIPELINE.length - 1 ? <span className="my-1 w-px flex-1 bg-white/10" aria-hidden /> : null}
                    </div>
                    <div className="pb-2">
                      <h3 className="text-[15px] font-semibold text-white">
                        {stage.title}
                        <span className="ml-2 font-display text-lg italic text-neutral-600">0{index + 1}</span>
                      </h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-neutral-400">{stage.detail}</p>
                    </div>
                  </li>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Why DocuMind                                                        */
/* ------------------------------------------------------------------ */

const REASONS: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: Quote,
    title: "Document-first, not model-first",
    description: "Retrieved context is the only permitted source of facts. The system prompt forbids inventing references.",
  },
  {
    icon: ScanSearch,
    title: "Transparent retrieval",
    description: "See every passage that shaped an answer: file, page, excerpt, and relevance score. No decorative citations.",
  },
  {
    icon: Braces,
    title: "Works with your model",
    description: "Any OpenAI-compatible endpoint plugs in through three environment variables. Without a key, answers stay grounded in extractive mode.",
  },
  {
    icon: Lock,
    title: "Production-grade stack",
    description: "Validated uploads, duplicate detection, per-user access control, and vectors that are deleted together with their document.",
  },
];

const FACTS = [
  { value: "Top 5", label: "passages retrieved per answer" },
  { value: "500 / 100", label: "chunk and overlap tokens" },
  { value: "2", label: "grounded answer modes" },
  { value: "0", label: "fabricated citations" },
];

export function Why() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="glass relative overflow-hidden rounded-3xl p-6 sm:p-10 lg:p-14">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-crimson-800/30 blur-[100px]" aria-hidden />
          <div className="relative grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <Reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-crimson-400">Why DocuMind AI</p>
              <h2 className="mt-3 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
                Trust is a <span className="italic text-crimson-300">feature</span>.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-neutral-400">
                Most chat tools sound confident. DocuMind is built so you can check: open the source, read the page, decide for yourself.
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                {FACTS.map((fact) => (
                  <div key={fact.label} className="bg-ink-900 p-4">
                    <dd className="font-display text-3xl text-white">{fact.value}</dd>
                    <dt className="mt-1 text-xs leading-snug text-neutral-500">{fact.label}</dt>
                  </div>
                ))}
              </dl>
            </Reveal>
            <ul className="flex flex-col gap-3">
              {REASONS.map((reason, index) => {
                const Icon = reason.icon;
                return (
                  <Reveal key={reason.title} delay={index * 0.08}>
                    <li className="flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-colors hover:border-crimson-600/30 sm:p-5">
                      <span className={tw("glass flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-crimson-300")}>
                        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                      </span>
                      <div>
                        <h3 className="text-[15px] font-semibold text-white">{reason.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-neutral-400">{reason.description}</p>
                      </div>
                    </li>
                  </Reveal>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Technology stack                                                    */
/* ------------------------------------------------------------------ */

const STACK = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "PostgreSQL",
  "Drizzle ORM",
  "Tailwind CSS",
  "Framer Motion",
  "pdf.js text extraction",
  "OpenAI-compatible LLM API",
  "Hashing-ngram embedder",
];

export function Stack() {
  return (
    <section className="pb-20 sm:pb-28">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-crimson-400">Technology stack</p>
          <h2 className="mt-3 font-display text-3xl text-white sm:text-4xl">Modern, boring where it matters.</h2>
          <ul className="mt-8 flex flex-wrap justify-center gap-2.5">
            {STACK.map((item) => (
              <li key={item} className="glass rounded-full px-4 py-2 text-[13px] font-medium text-neutral-200 transition hover:border-crimson-600/40 hover:text-white">
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
