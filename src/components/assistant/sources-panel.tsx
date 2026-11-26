"use client";

import { ExternalLink, FileText, SearchX } from "lucide-react";
import type { RetrievalInfo, Source } from "@/lib/types";
import { formatDuration, tw } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

interface SourcesPanelProps {
  sources: Source[];
  retrieval: RetrievalInfo | null;
  showDetails: boolean;
  highlight: string | null;
  onOpen: (source: Source) => void;
}

function percent(score: number): number {
  return Math.max(2, Math.round(Math.min(1, Math.max(0, score)) * 100));
}

/** Right panel: the passages retrieval actually returned for the latest answer. */
export function SourcesPanel({ sources, retrieval, showDetails, highlight, onOpen }: SourcesPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-4">
        <FileText className="h-4 w-4 text-crimson-300" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold text-white">Sources</h2>
        {retrieval ? (
          <span className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium tabular-nums text-neutral-300">
            {sources.length} of {retrieval.topK} passages
          </span>
        ) : null}
      </div>

      {retrieval && showDetails ? (
        <dl className="grid grid-cols-3 gap-px border-b border-white/10 bg-ink-600/60">
          {[
            { term: "Best relevance", value: percent(retrieval.bestScore) > 2 || retrieval.bestScore > 0 ? `${percent(retrieval.bestScore)}%` : "—" },
            { term: "Threshold", value: `${Math.round(retrieval.minScore * 100)}%` },
            { term: "Candidates", value: `${retrieval.candidates}` },
            { term: "Embedding", value: retrieval.provider === "local" ? "Local" : "OpenAI-compatible" },
            { term: "Scope", value: retrieval.documentIds ? `${retrieval.documentIds.length} doc${retrieval.documentIds.length === 1 ? "" : "s"}` : "All documents" },
            { term: "Retrieval time", value: formatDuration(retrieval.durationMs) },
          ].map((item) => (
            <div key={item.term} className="bg-ink-850 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">{item.term}</dt>
              <dd className="mt-0.5 truncate text-xs font-medium text-neutral-200" title={String(item.value)}>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="scrollbar-slim flex-1 overflow-y-auto p-3">
        {!retrieval ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="glass mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-crimson-300">
              <FileText className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <h3 className="text-sm font-semibold text-white">Sources appear here</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
              When you ask a question, the passages actually retrieved from your documents are listed with file name, page
              number and the matched excerpt.
            </p>
          </div>
        ) : sources.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="glass mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-neutral-400">
              <SearchX className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <h3 className="text-sm font-semibold text-white">Nothing relevant was retrieved</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
              {retrieval.candidates === 0
                ? "Your knowledge base has no indexed chunks yet. Upload and index a document first."
                : `${retrieval.candidates} candidate passage${retrieval.candidates === 1 ? "" : "s"} were compared, but none reached the ${Math.round(retrieval.minScore * 100)}% relevance threshold (best ${percent(retrieval.bestScore)}%). That is why no answer was produced.`}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {sources.map((source) => (
              <li key={source.chunkId}>
                <article
                  id={`source-${source.label.toLowerCase()}`}
                  className={tw(
                    "glass rounded-xl p-3.5 transition-shadow duration-500",
                    highlight === source.label && "shadow-crimson",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="crimson">{source.label}</Badge>
                    <p className="min-w-0 truncate text-[13px] font-medium text-white" title={source.documentName}>
                      {source.documentName}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
                    <span>Page {source.pageNumber}</span>
                    <span className="tabular-nums">Relevance {percent(source.score)}%</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                    <div
                      className="h-full rounded-full bg-linear-to-r from-crimson-800 to-crimson-400"
                      style={{ width: `${percent(source.score)}%` }}
                    />
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-neutral-400">{source.snippet}</p>
                  <button
                    type="button"
                    onClick={() => onOpen(source)}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-crimson-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60"
                  >
                    Open page {source.pageNumber}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
