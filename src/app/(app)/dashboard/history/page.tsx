"use client";

import { useState } from "react";
import { MessageSquare, Trash2, TriangleAlert } from "lucide-react";
import type { ConversationSummary } from "@/lib/types";
import { formatDateTime, formatRelativeTime, tw } from "@/lib/format";
import { useToast } from "@/context/toast";
import { useConversations } from "@/hooks/use-conversations";
import { chatApi } from "@/services/api";
import { Button, ButtonLink } from "@/components/ui/button";
import { Eyebrow, GlassCard } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";

export default function HistoryPage() {
  const { conversations, error, refresh, setConversations } = useConversations();
  const { toast } = useToast();
  const [pending, setPending] = useState<ConversationSummary | "all" | null>(null);
  const [deleting, setDeleting] = useState(false);

  const removeOne = async (conversation: ConversationSummary) => {
    setDeleting(true);
    try {
      await chatApi.deleteConversation(conversation.id);
      setConversations((prev) => (prev ?? []).filter((c) => c.id !== conversation.id));
      toast({ variant: "success", title: "Conversation deleted" });
      setPending(null);
    } catch (err) {
      toast({ variant: "error", title: "Could not delete conversation", description: err instanceof Error ? err.message : undefined });
    } finally {
      setDeleting(false);
    }
  };

  const removeAll = async () => {
    setDeleting(true);
    try {
      const result = await chatApi.deleteAll();
      setConversations([]);
      toast({ variant: "success", title: `Deleted ${result.deleted} conversation${result.deleted === 1 ? "" : "s"}` });
      setPending(null);
    } catch (err) {
      toast({ variant: "error", title: "Could not clear history", description: err instanceof Error ? err.message : undefined });
    } finally {
      setDeleting(false);
    }
  };

  const total = conversations?.length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Conversations</Eyebrow>
          <h2 className="mt-2 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
            Chat <span className="italic text-crimson-300">History</span>
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            {conversations ? `${total} saved conversation${total === 1 ? "" : "s"}` : "Loading your conversations"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {total > 0 ? (
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setPending("all")}>
              Clear all history
            </Button>
          ) : null}
          <ButtonLink href="/dashboard/assistant" icon={<MessageSquare className="h-4 w-4" />}>
            New conversation
          </ButtonLink>
        </div>
      </header>

      {error ? (
        <GlassCard className="flex flex-col items-center gap-3 p-10 text-center">
          <TriangleAlert className="h-6 w-6 text-crimson-400" />
          <p className="text-sm text-neutral-300">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            Retry
          </Button>
        </GlassCard>
      ) : !conversations ? (
        <GlassCard className="p-4">
          <ListSkeleton rows={5} />
        </GlassCard>
      ) : total === 0 ? (
        <EmptyState
          icon={<MessageSquare />}
          title="No conversations yet"
          description="Every question you ask the assistant is saved here with the sources it used, so you can pick up where you left off."
          actions={
            <ButtonLink href="/dashboard/assistant" icon={<MessageSquare className="h-4 w-4" />}>
              Ask your first question
            </ButtonLink>
          }
        />
      ) : (
        <GlassCard>
          <ul aria-label="Conversations" className="divide-y divide-white/[0.06]">
            {conversations.map((conversation) => {
              const scope = conversation.documentIds
                ? `${conversation.documentIds.length} document${conversation.documentIds.length === 1 ? "" : "s"} scoped`
                : "All documents";
              return (
                <li key={conversation.id} className="group grid gap-2 px-4 py-3.5 transition-colors hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                  <a
                    href={`/dashboard/assistant?c=${conversation.id}`}
                    className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60"
                  >
                    <span className="glass flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-crimson-300">
                      <MessageSquare className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">{conversation.title}</span>
                      <span className="block truncate text-xs text-neutral-500">
                        {conversation.messageCount} messages · {scope} · {formatDateTime(conversation.updatedAt)}
                      </span>
                    </span>
                  </a>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <span className="text-xs text-neutral-600">{formatRelativeTime(conversation.updatedAt)}</span>
                    <button
                      type="button"
                      aria-label={`Delete conversation "${conversation.title}"`}
                      title="Delete conversation"
                      onClick={() => setPending(conversation)}
                      className={tw(
                        "flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition",
                        "hover:bg-crimson-900/40 hover:text-crimson-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60",
                      )}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </GlassCard>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void (pending === "all" ? removeAll() : pending ? removeOne(pending) : Promise.resolve())}
        loading={deleting}
        confirmLabel={pending === "all" ? "Delete all" : "Delete"}
        title={pending === "all" ? "Delete your entire chat history?" : "Delete this conversation?"}
        description={
          pending === "all"
            ? "All conversations and their messages will be permanently removed. Your documents and their vectors are not affected."
            : "The conversation and its messages will be permanently removed. Your documents are not affected."
        }
      />
    </div>
  );
}
