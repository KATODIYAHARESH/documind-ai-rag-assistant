"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, PanelLeft, PanelRight, Sparkles, TriangleAlert, UploadCloud, X } from "lucide-react";
import type { DocumentDto, Source } from "@/lib/types";
import { truncate, tw } from "@/lib/format";
import { useToast } from "@/context/toast";
import { useDocuments } from "@/hooks/use-documents";
import { useConversations } from "@/hooks/use-conversations";
import { usePreferences } from "@/hooks/use-preferences";
import { chatApi, documentsApi } from "@/services/api";
import { streamChat } from "@/services/chat-stream";
import { Button, ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { LogoMark } from "@/components/ui/logo";
import { DocumentPreview } from "@/components/document-preview";
import { Composer } from "./composer";
import { ConversationPanel } from "./conversation-panel";
import { MessageBubble, TypingDots } from "./message-bubble";
import { SourcesPanel } from "./sources-panel";
import type { UIMessage } from "./types";

const PANEL_BUTTON =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60";

function ConversationSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 py-6" aria-busy aria-label="Loading conversation">
      <div className="flex justify-end"><Skeleton className="h-14 w-2/3 rounded-2xl" /></div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
      <div className="flex justify-end"><Skeleton className="h-12 w-1/2 rounded-2xl" /></div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function AssistantWorkspace() {
  const searchParams = useSearchParams();
  const conversationParam = searchParams.get("c");
  const documentParam = searchParams.get("doc");

  const { toast } = useToast();
  const { prefs } = usePreferences();
  const { documents, refresh: refreshDocuments } = useDocuments();
  const { conversations, refresh: refreshConversations, setConversations } = useConversations();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [initialising, setInitialising] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allDocuments, setAllDocuments] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; originalName: string; pageCount: number | null; chunkCount: number } | null>(null);
  const [previewPage, setPreviewPage] = useState<number | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addingSamples, setAddingSamples] = useState(false);

  const activeIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const atBottomRef = useRef(true);
  const firstRunRef = useRef(true);
  const loadSeq = useRef(0);
  const handledDocRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const indexed = useMemo(() => (documents ?? []).filter((d) => d.status === "indexed"), [documents]);

  /* ------------------------------------------------------------------ */
  /* Conversation loading                                                */
  /* ------------------------------------------------------------------ */

  const openConversation = useCallback(async (id: string | null) => {
    abortRef.current?.abort();
    const seq = ++loadSeq.current;
    activeIdRef.current = id;
    setActiveId(id);
    setStreaming(false);
    setLoadError(null);
    if (!id) {
      setMessages([]);
      setLoadingConversation(false);
      return;
    }
    setLoadingConversation(true);
    try {
      const data = await chatApi.getConversation(id);
      if (seq !== loadSeq.current) return;
      const scope = data.conversation.documentIds;
      if (scope?.length) {
        setAllDocuments(false);
        setSelectedIds(scope);
      } else {
        setAllDocuments(true);
        setSelectedIds([]);
      }
      setMessages(data.messages.map((m) => ({ ...m, sources: m.sources ?? null })));
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setMessages([]);
      setLoadError(err instanceof Error ? err.message : "This conversation could not be loaded.");
    } finally {
      if (seq === loadSeq.current) setLoadingConversation(false);
    }
  }, []);

  // Follow the ?c= URL parameter (navigation from history, sidebar or the address bar).
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      void openConversation(conversationParam).finally(() => setInitialising(false));
      return;
    }
    if (conversationParam !== activeIdRef.current) void openConversation(conversationParam);
  }, [conversationParam, openConversation]);

  // ?doc=<id> (sidebar entry "ask about this document") starts a new, scoped conversation.
  useEffect(() => {
    if (documentParam && documentParam !== handledDocRef.current) {
      handledDocRef.current = documentParam;
      void openConversation(null);
      setAllDocuments(false);
      setSelectedIds([documentParam]);
    } else if (!documentParam) {
      handledDocRef.current = null;
    }
  }, [documentParam, openConversation]);

  /* ------------------------------------------------------------------ */
  /* Knowledge-base scope                                                */
  /* ------------------------------------------------------------------ */

  // Drop selections that are no longer indexed (deleted or re-processing).
  useEffect(() => {
    if (!documents) return;
    const ready = new Set(indexed.map((d) => d.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => ready.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [documents, indexed]);

  useEffect(() => {
    if (!allDocuments && selectedIds.length === 0) setAllDocuments(true);
  }, [allDocuments, selectedIds]);

  const toggleAll = useCallback((next: boolean) => {
    setAllDocuments(next);
    if (next) setSelectedIds([]);
  }, []);

  const toggleDocument = useCallback((id: string) => {
    setAllDocuments(false);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const scopeLabel = useMemo(() => {
    if (indexed.length === 0) return "No indexed documents yet";
    if (allDocuments) return `Searching all documents · ${indexed.length} indexed`;
    const names = selectedIds.map((id) => documents?.find((d) => d.id === id)?.originalName.replace(/\.pdf$/i, "") ?? "");
    return names.length > 1 ? `Searching ${names.length} selected documents` : `Searching “${truncate(names[0] ?? "", 44)}”`;
  }, [allDocuments, indexed.length, selectedIds, documents]);

  /* ------------------------------------------------------------------ */
  /* Scrolling                                                           */
  /* ------------------------------------------------------------------ */

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    atBottomRef.current = near;
    setAtBottom(near);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottomRef.current = true;
    setAtBottom(true);
  }, []);

  const visibleMessages = messages.length;
  useEffect(() => {
    if (atBottomRef.current) scrollToBottom(false);
  }, [visibleMessages, loadingConversation, scrollToBottom]);

  /* ------------------------------------------------------------------ */
  /* Sending / streaming                                                 */
  /* ------------------------------------------------------------------ */

  const send = useCallback(
    async (rawQuestion: string, regenerate = false) => {
      const question = rawQuestion.trim();
      if (!question || streaming) return;
      const scope = allDocuments ? null : selectedIds.length ? selectedIds : null;
      const assistantKey = `assistant-${Date.now()}`;
      const placeholder: UIMessage = { id: assistantKey, role: "assistant", content: "", createdAt: new Date().toISOString(), pending: true };

      if (regenerate) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") next[next.length - 1] = placeholder;
          else next.push(placeholder);
          return next;
        });
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `user-${Date.now()}`, role: "user", content: question, createdAt: new Date().toISOString() },
          placeholder,
        ]);
      }

      setStreaming(true);
      scrollToBottom(false);
      const controller = new AbortController();
      abortRef.current = controller;
      const patch = (fn: (m: UIMessage) => UIMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantKey ? fn(m) : m)));
      let finished = false;
      let failed = false;

      try {
        await streamChat(
          { question, conversationId: activeIdRef.current, documentIds: scope, regenerate },
          {
            onSources: (sources, retrieval) => patch((m) => ({ ...m, pending: false, streaming: true, sources, retrieval })),
            onDelta: (text) => patch((m) => ({ ...m, pending: false, streaming: true, content: m.content + text })),
            onDone: (done) => {
              finished = true;
              if (done.conversationId && done.conversationId !== activeIdRef.current) {
                activeIdRef.current = done.conversationId;
                setActiveId(done.conversationId);
                window.history.replaceState(null, "", `/dashboard/assistant?c=${done.conversationId}`);
              }
              patch((m) => ({
                ...m,
                pending: false,
                streaming: false,
                model: done.model ?? null,
                mode: done.cancelled ? "interrupted" : done.mode ?? null,
                latencyMs: done.latencyMs ?? null,
              }));
            },
            onError: (message) => {
              failed = true;
              patch((m) => ({ ...m, pending: false, streaming: false, error: message }));
            },
          },
          controller.signal,
        );
      } finally {
        if (controller.signal.aborted && !finished) {
          patch((m) =>
            m.content
              ? { ...m, pending: false, streaming: false, error: null, mode: "interrupted" }
              : { ...m, pending: false, streaming: false, error: "Generation was stopped before any answer was produced." },
          );
        } else if (!finished && !failed) {
          patch((m) => (m.error ? m : { ...m, pending: false, streaming: false, error: "The connection closed before the answer finished. Please try again." }));
        }
        if (abortRef.current === controller) abortRef.current = null;
        setStreaming(false);
        void refreshConversations();
      }
    },
    [streaming, allDocuments, selectedIds, scrollToBottom, refreshConversations],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  /* ------------------------------------------------------------------ */
  /* Derived data                                                        */
  /* ------------------------------------------------------------------ */

  const lastRetrieval = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.retrieval) return m;
    }
    return null;
  }, [messages]);
  const sources: Source[] = lastRetrieval?.sources ?? [];
  const retrieval = lastRetrieval?.retrieval ?? null;

  const lastUser = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") return messages[i];
    return null;
  }, [messages]);
  const canRegenerate = lastUser !== null && !streaming;

  const title = useMemo(() => {
    const saved = conversations?.find((c) => c.id === activeId)?.title;
    if (saved) return truncate(saved, 64);
    if (lastUser) return truncate(lastUser.content, 64);
    return "New conversation";
  }, [conversations, activeId, lastUser]);

  const suggestions = useMemo(() => {
    if (indexed.length === 0) return [];
    const first = truncate(indexed[0].originalName.replace(/\.pdf$/i, ""), 48);
    return [
      `Summarize the key points of ${first}`,
      "What are the main topics covered in these documents?",
      "List the important numbers, dates and metrics mentioned.",
      "Which technologies, tools or methods are referenced?",
    ];
  }, [indexed]);

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  const cite = useCallback((tag: string) => {
    setHighlight(tag);
    setSourcesOpen(true);
    window.setTimeout(() => {
      document.getElementById(`source-${tag.toLowerCase()}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    window.setTimeout(() => setHighlight(null), 1600);
  }, []);

  const openSource = useCallback(
    (source: Source) => {
      const document: DocumentDto | undefined = documents?.find((d) => d.id === source.documentId);
      setPreviewPage(source.pageNumber);
      setPreview(
        document
          ? { id: document.id, originalName: document.originalName, pageCount: document.pageCount, chunkCount: document.chunkCount }
          : { id: source.documentId, originalName: source.documentName, pageCount: null, chunkCount: 0 },
      );
    },
    [documents],
  );

  const addSamples = async () => {
    setAddingSamples(true);
    try {
      const result = await documentsApi.addSamples();
      toast({
        variant: result.created ? "success" : "info",
        title: result.message,
        description: result.created ? "They will be searchable in a few seconds." : undefined,
      });
      await refreshDocuments();
    } catch (err) {
      toast({ variant: "error", title: "Could not add sample documents", description: err instanceof Error ? err.message : undefined });
    } finally {
      setAddingSamples(false);
    }
  };

  const deleteConversation = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await chatApi.deleteConversation(pendingDelete.id);
      const wasActive = pendingDelete.id === activeIdRef.current;
      setConversations((prev) => (prev ?? []).filter((c) => c.id !== pendingDelete.id));
      if (wasActive) {
        await openConversation(null);
        window.history.replaceState(null, "", "/dashboard/assistant");
      }
      toast({ variant: "success", title: "Conversation deleted" });
      setPendingDelete(null);
    } catch (err) {
      toast({ variant: "error", title: "Could not delete conversation", description: err instanceof Error ? err.message : undefined });
    } finally {
      setDeleting(false);
    }
  };

  const closePanels = useCallback(() => {
    setLeftOpen(false);
    setSourcesOpen(false);
  }, []);

  const loading = initialising || loadingConversation;
  const showEmpty = !loading && messages.length === 0;

  return (
    <div className="flex h-full w-full min-w-0">
      {/* ------------------------------ Left panel ------------------------------ */}
      <AnimatePresence>
        {leftOpen ? (
          <motion.button
            key="left-overlay"
            type="button"
            aria-label="Close panel"
            className="fixed inset-0 z-40 cursor-default bg-black/70 backdrop-blur-sm xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePanels}
          />
        ) : null}
      </AnimatePresence>
      <aside
        aria-label="Conversations and knowledge base"
        className={tw(
          "w-[300px] max-w-[86vw] shrink-0 flex-col border-r border-white/10 bg-ink-850",
          leftOpen ? "fixed inset-y-0 left-0 z-50 animate-drawer-left shadow-glass xl:animate-none" : "hidden",
          "xl:static xl:flex xl:shadow-none",
        )}
      >
        <ConversationPanel
          documents={documents}
          allDocuments={allDocuments}
          onAllDocuments={toggleAll}
          selectedIds={selectedIds}
          onToggleDocument={toggleDocument}
          conversations={conversations}
          activeId={activeId}
          disabled={streaming}
          onDelete={(conversation) => setPendingDelete({ id: conversation.id, title: conversation.title })}
          onClose={closePanels}
        />
      </aside>

      {/* ------------------------------ Center ------------------------------ */}
      <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3 sm:px-4">
          <button type="button" className={tw(PANEL_BUTTON, "xl:hidden")} onClick={() => setLeftOpen(true)} aria-label="Open conversations panel">
            <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{title}</p>
            <p className="truncate text-[11px] text-neutral-500">{scopeLabel}</p>
          </div>
          <button
            type="button"
            className={tw(PANEL_BUTTON, "relative lg:hidden")}
            onClick={() => setSourcesOpen(true)}
            aria-label={`Show sources (${sources.length})`}
          >
            <PanelRight className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {sources.length > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-crimson-600 px-1 text-[10px] font-semibold text-white">
                {sources.length}
              </span>
            ) : null}
          </button>
        </header>

        <div ref={scrollRef} onScroll={onScroll} className="scrollbar-slim relative flex-1 overflow-y-auto">
          {loading ? (
            <ConversationSkeleton />
          ) : showEmpty ? (
            <div className="mx-auto flex min-h-full w-full max-w-[860px] flex-col items-center justify-center px-4 py-10 text-center">
              <div className="relative mb-5">
                <div className="absolute inset-0 rounded-full bg-crimson-600/40 blur-3xl" aria-hidden />
                <span className="glass-strong relative flex h-16 w-16 items-center justify-center rounded-2xl">
                  <LogoMark className="h-9 w-9" />
                </span>
              </div>
              <Eyebrow>AI Assistant</Eyebrow>
              <h2 className="mt-3 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
                Ask your documents <span className="italic text-crimson-300">anything</span>.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-neutral-400">
                Answers are built only from passages retrieved from your knowledge base, each cited with its file name and page.
              </p>

              {indexed.length === 0 ? (
                <div className="glass mt-8 w-full max-w-lg p-5 text-left">
                  <p className="text-sm font-medium text-white">Your knowledge base has no indexed documents yet.</p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                    Upload a PDF or add the built-in sample documents. Once indexed, you can ask questions right here.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" loading={addingSamples} onClick={() => void addSamples()} icon={<Sparkles className="h-3.5 w-3.5" />}>
                      Add sample documents
                    </Button>
                    <ButtonLink size="sm" variant="secondary" href="/dashboard/documents" icon={<UploadCloud className="h-3.5 w-3.5" />}>
                      Upload PDF
                    </ButtonLink>
                  </div>
                </div>
              ) : (
                <div className="mt-8 w-full max-w-2xl">
                  <p className="mb-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Suggested questions</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        disabled={streaming}
                        onClick={() => void send(suggestion)}
                        className="glass flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] leading-snug text-neutral-300 transition hover:border-crimson-600/40 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60 disabled:opacity-50"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-crimson-500" aria-hidden />
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : loadError ? (
            <div className="mx-auto flex min-h-full w-full max-w-[640px] flex-col items-center justify-center px-6 text-center">
              <TriangleAlert className="h-7 w-7 text-crimson-400" />
              <h2 className="mt-3 text-base font-semibold text-white">Conversation unavailable</h2>
              <p className="mt-1.5 text-sm text-neutral-400">{loadError}</p>
              <div className="mt-5 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => void openConversation(conversationParam)}>
                  Try again
                </Button>
                <Button size="sm" onClick={() => void openConversation(null)}>
                  New conversation
                </Button>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-4 py-6 sm:px-6">
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isLast={index === messages.length - 1}
                  busy={streaming}
                  canRegenerate={canRegenerate}
                  onRegenerate={() => (lastUser ? void send(lastUser.content, true) : undefined)}
                  onCitation={cite}
                />
              ))}
              {streaming && messages[messages.length - 1]?.pending && sources.length > 0 ? (
                <p className="pl-1 text-xs text-neutral-500">
                  <TypingDots label="Grounding the answer in the retrieved passages…" />
                </p>
              ) : null}
            </div>
          )}

          {!atBottom && !loading ? (
            <button
              type="button"
              onClick={() => scrollToBottom()}
              aria-label="Scroll to latest message"
              className="glass-strong absolute bottom-4 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full text-neutral-300 shadow-glass transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <Composer
          value={input}
          onChange={setInput}
          onSend={(text) => void send(text)}
          onStop={stop}
          streaming={streaming}
          disabled={indexed.length === 0 || loading}
          enterToSend={prefs.enterToSend}
          scopeLabel={scopeLabel}
        />
      </section>

      {/* ------------------------------ Right panel ------------------------------ */}
      <AnimatePresence>
        {sourcesOpen ? (
          <motion.button
            key="right-overlay"
            type="button"
            aria-label="Close sources"
            className="fixed inset-0 z-40 cursor-default bg-black/70 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePanels}
          />
        ) : null}
      </AnimatePresence>
      <aside
        aria-label="Retrieved sources"
        className={tw(
          "w-[340px] max-w-[88vw] shrink-0 flex-col border-l border-white/10 bg-ink-850",
          sourcesOpen ? "fixed inset-y-0 right-0 z-50 animate-drawer-right shadow-glass lg:animate-none" : "hidden",
          "lg:static lg:flex lg:shadow-none",
        )}
      >
        <SourcesPanel sources={sources} retrieval={retrieval} showDetails={prefs.showRetrieval} highlight={highlight} onOpen={openSource} />
        <button
          type="button"
          onClick={closePanels}
          aria-label="Close sources"
          className="absolute right-3 top-3.5 flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </aside>

      <DocumentPreview document={preview} page={previewPage} onClose={() => setPreview(null)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void deleteConversation()}
        loading={deleting}
        title="Delete this conversation?"
        description={
          <>
            <span className="text-white">{pendingDelete?.title}</span> and its messages will be permanently removed. Your documents stay
            untouched.
          </>
        }
      />
    </div>
  );
}
