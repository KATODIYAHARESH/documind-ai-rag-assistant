"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate } from "framer-motion";
import { ArrowRight, CheckCircle2, Files, Layers, MessageSquare, Sparkles, UploadCloud, type LucideIcon } from "lucide-react";
import type { ConversationSummary, DashboardStats, DocumentDto } from "@/lib/types";
import { formatBytes, formatRelativeTime, truncate } from "@/lib/format";
import { useAuth } from "@/context/auth";
import { useToast } from "@/context/toast";
import { useStats } from "@/hooks/use-stats";
import { dashboardApi, documentsApi } from "@/services/api";
import { Button, ButtonLink } from "@/components/ui/button";
import { Divider, Eyebrow, GlassCard } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentMeta, StatusBadge } from "@/components/document-status";

type StatKey = "documents" | "indexed" | "chunks" | "questions";

const CARDS: Array<{ key: StatKey; label: string; hint: string; icon: LucideIcon }> = [
  { key: "documents", label: "Total documents", hint: "PDFs in your library", icon: Files },
  { key: "indexed", label: "Processed documents", hint: "Successfully indexed", icon: CheckCircle2 },
  { key: "chunks", label: "Indexed chunks", hint: "Searchable passages", icon: Layers },
  { key: "questions", label: "Questions asked", hint: "Across all conversations", icon: MessageSquare },
];

function StatCard({ label, hint, icon: Icon, value, loading }: { label: string; hint: string; icon: LucideIcon; value: number; loading: boolean }) {
  const [display, setDisplay] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const controls = animate(current.current, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => {
        current.current = v;
        setDisplay(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value]);

  return (
    <GlassCard hover className="relative overflow-hidden p-5">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-crimson-800/30 blur-3xl" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-neutral-400">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-10 w-20 bg-transparent" />
          ) : (
            <p className="mt-1 font-display text-[40px] leading-none text-white tabular-nums">{display.toLocaleString("en-US")}</p>
          )}
        </div>
        <span className="glass flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-crimson-300">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
      </div>
      <p className="relative mt-3 text-xs text-neutral-500">{hint}</p>
    </GlassCard>
  );
}

function DocumentLine({ document }: { document: DocumentDto }) {
  return (
    <li>
      <Link href="/dashboard/documents" className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
        <span className="w-40 shrink-0">
          <StatusBadge status={document.status} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-white">{truncate(document.originalName, 52)}</span>
          <DocumentMeta document={document} />
        </span>
        <span className="hidden w-16 shrink-0 text-right text-xs text-neutral-500 sm:block">{formatBytes(document.sizeBytes)}</span>
      </Link>
    </li>
  );
}

function ConversationLine({ conversation }: { conversation: ConversationSummary }) {
  return (
    <li>
      <Link
        href={`/dashboard/assistant?c=${conversation.id}`}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
      >
        <span className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-crimson-300">
          <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-white">{truncate(conversation.title, 56) || "Untitled conversation"}</span>
          <span className="block truncate text-xs text-neutral-500">
            {conversation.messageCount} messages · {formatRelativeTime(conversation.updatedAt)}
            {conversation.documentIds ? ` · ${conversation.documentIds.length} scoped document${conversation.documentIds.length === 1 ? "" : "s"}` : " · all documents"}
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-neutral-600 transition group-hover:text-crimson-300" />
      </Link>
    </li>
  );
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
      <h3 className="text-[15px] font-semibold text-white">{title}</h3>
      {action}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { stats, loading, error, refresh } = useStats();
  const [addingSamples, setAddingSamples] = useState(false);

  const firstName = (user?.name ?? "").split(" ")[0] || "there";
  // Time-based greeting is computed after mount so server and client markup match.
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);

  const addSamples = async () => {
    setAddingSamples(true);
    try {
      const result = await documentsApi.addSamples();
      toast({
        variant: "success",
        title: result.message,
        description: "Follow the processing status under My Documents, then ask a question.",
      });
      await refresh();
    } catch (err) {
      toast({ variant: "error", title: "Could not add samples", description: err instanceof Error ? err.message : undefined });
    } finally {
      setAddingSamples(false);
    }
  };

  const totals: DashboardStats["totals"] | null = stats?.totals ?? null;
  const empty = totals ? totals.documents === 0 && totals.questions === 0 : false;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Eyebrow>Overview</Eyebrow>
          <h2 className="mt-2 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
            {greeting}, <span className="italic text-crimson-300">{firstName}</span>.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
            {totals && totals.indexed > 0
              ? `Your knowledge base holds ${totals.indexed} indexed document${totals.indexed === 1 ? "" : "s"} across ${totals.chunks.toLocaleString("en-US")} searchable chunks.`
              : "Upload a PDF and turn it into a knowledge base you can question."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/dashboard/documents" variant="secondary" icon={<UploadCloud className="h-4 w-4" />}>
            Upload documents
          </ButtonLink>
          <ButtonLink href="/dashboard/assistant" icon={<Sparkles className="h-4 w-4" />}>
            Ask AI
          </ButtonLink>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            hint={card.hint}
            icon={card.icon}
            value={totals ? totals[card.key] : 0}
            loading={loading}
          />
        ))}
      </div>

      {error ? (
        <GlassCard className="flex items-center justify-between gap-4 p-5">
          <p className="text-sm text-crimson-300">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            Retry
          </Button>
        </GlassCard>
      ) : null}

      {empty ? (
        <GlassCard className="relative overflow-hidden p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-crimson-800/30 blur-3xl" aria-hidden />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <Eyebrow>Start here</Eyebrow>
              <h3 className="mt-2 font-display text-3xl text-white">Three steps to your first cited answer.</h3>
              <ol className="mt-4 flex flex-col gap-2 text-sm text-neutral-400">
                <li><span className="mr-2 font-semibold text-crimson-300">01</span>Upload PDFs or add the built-in sample documents.</li>
                <li><span className="mr-2 font-semibold text-crimson-300">02</span>DocuMind extracts, chunks, embeds and indexes every page.</li>
                <li><span className="mr-2 font-semibold text-crimson-300">03</span>Ask a question and trace every answer back to its page.</li>
              </ol>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button loading={addingSamples} onClick={() => void addSamples()} icon={<Sparkles className="h-4 w-4" />}>
                Add sample documents
              </Button>
              <ButtonLink variant="secondary" href="/dashboard/documents" icon={<UploadCloud className="h-4 w-4" />}>
                Upload your own PDF
              </ButtonLink>
            </div>
          </div>
        </GlassCard>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <CardHeader
            title="Recent uploads"
            action={
              <Link href="/dashboard/documents" className="flex items-center gap-1 text-xs font-medium text-neutral-400 transition hover:text-crimson-300">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : stats && stats.recentDocuments.length > 0 ? (
            <ul className="scrollbar-slim max-h-[340px] overflow-y-auto p-2">
              {stats.recentDocuments.map((doc, index) => (
                <div key={doc.id}>
                  {index > 0 ? <Divider className="my-0.5 opacity-60" /> : null}
                  <DocumentLine document={doc} />
                </div>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-neutral-400">No documents yet.</p>
              <ButtonLink size="sm" variant="secondary" href="/dashboard/documents" className="mt-4" icon={<UploadCloud className="h-4 w-4" />}>
                Upload a PDF
              </ButtonLink>
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <CardHeader
            title="Recent conversations"
            action={
              <Link href="/dashboard/history" className="flex items-center gap-1 text-xs font-medium text-neutral-400 transition hover:text-crimson-300">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : stats && stats.recentConversations.length > 0 ? (
            <ul className="scrollbar-slim max-h-[340px] overflow-y-auto p-2">
              {stats.recentConversations.map((conversation, index) => (
                <div key={conversation.id}>
                  {index > 0 ? <Divider className="my-0.5 opacity-60" /> : null}
                  <ConversationLine conversation={conversation} />
                </div>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-neutral-400">You haven&apos;t asked anything yet.</p>
              <ButtonLink size="sm" href="/dashboard/assistant" className="mt-4" icon={<Sparkles className="h-4 w-4" />}>
                Start a conversation
              </ButtonLink>
            </div>
          )}
        </GlassCard>
      </div>

      <p className="pb-4 text-xs text-neutral-600">
        {totals
          ? `${formatBytes(totals.storageBytes)} stored · ${totals.conversations} conversation${totals.conversations === 1 ? "" : "s"} · all figures computed live from your workspace`
          : "\u00a0"}
      </p>
    </div>
  );
}
