"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSearch, Files, Info, Search, Sparkles, TriangleAlert, UploadCloud, X } from "lucide-react";
import type { DocumentDto } from "@/lib/types";
import { tw } from "@/lib/format";
import { useToast } from "@/context/toast";
import { useDocuments } from "@/hooks/use-documents";
import { configApi, documentsApi, type UploadResult } from "@/services/api";
import { Button, ButtonLink } from "@/components/ui/button";
import { Eyebrow, GlassCard } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { DocumentPreview } from "@/components/document-preview";
import { StatusBadge } from "@/components/document-status";
import { UploadZone } from "@/components/documents/upload-zone";
import { DocumentRow } from "@/components/documents/document-row";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

type Filter = "all" | "indexed" | "processing" | "attention";

export default function DocumentsPage() {
  const { documents, loading, error, refresh, setDocuments } = useDocuments();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<DocumentDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addingSamples, setAddingSamples] = useState(false);
  const [limits, setLimits] = useState({ maxBytes: MAX_UPLOAD_BYTES, label: "15 MB" });

  useEffect(() => {
    let active = true;
    configApi
      .get()
      .then((c) => {
        if (active) setLimits({ maxBytes: c.limits.maxUploadBytes, label: c.limits.maxUploadLabel });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    const list = documents ?? [];
    return {
      all: list.length,
      indexed: list.filter((d) => d.status === "indexed").length,
      processing: list.filter((d) => d.status === "processing").length,
      attention: list.filter((d) => d.status === "error" || d.status === "needs_ocr").length,
    };
  }, [documents]);

  const filtered = useMemo(() => {
    const list = documents ?? [];
    const needle = query.trim().toLowerCase();
    return list.filter((document) => {
      if (filter === "indexed" && document.status !== "indexed") return false;
      if (filter === "processing" && document.status !== "processing") return false;
      if (filter === "attention" && document.status !== "error" && document.status !== "needs_ocr") return false;
      return needle ? document.originalName.toLowerCase().includes(needle) : true;
    });
  }, [documents, filter, query]);

  const onUploadFinished = (result: UploadResult) => {
    setUploading(false);
    if (result.documents.length) {
      setDocuments((prev) => {
        const merged = [...result.documents, ...(prev ?? []).filter((d) => !result.documents.some((n) => n.id === d.id))];
        return merged;
      });
      void refresh();
    }
  };

  const addSamples = async () => {
    setAddingSamples(true);
    try {
      const result = await documentsApi.addSamples();
      toast({
        variant: result.created ? "success" : "info",
        title: result.message,
        description: result.created ? "They will be indexed in a few seconds." : undefined,
      });
      await refresh();
    } catch (err) {
      toast({ variant: "error", title: "Could not add sample documents", description: err instanceof Error ? err.message : undefined });
    } finally {
      setAddingSamples(false);
    }
  };

  const retry = async (document: DocumentDto) => {
    setBusyId(document.id);
    try {
      await documentsApi.reprocess(document.id);
      toast({ variant: "info", title: "Reprocessing started", description: document.originalName });
      await refresh();
    } catch (err) {
      toast({ variant: "error", title: "Could not retry", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    try {
      await documentsApi.remove(target.id);
      setDocuments((prev) => (prev ?? []).filter((d) => d.id !== target.id));
      toast({ variant: "success", title: "Document deleted", description: "Its vectors and metadata were removed as well." });
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      toast({ variant: "error", title: "Could not delete document", description: err instanceof Error ? err.message : undefined });
    } finally {
      setDeleting(false);
    }
  };

  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: "all", label: "All", count: counts.all },
    { key: "indexed", label: "Indexed", count: counts.indexed },
    { key: "processing", label: "Processing", count: counts.processing },
    { key: "attention", label: "Needs attention", count: counts.attention },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Library</Eyebrow>
          <h2 className="mt-2 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
            My <span className="italic text-crimson-300">Documents</span>
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            {counts.all} document{counts.all === 1 ? "" : "s"} · {counts.indexed} indexed
          </p>
        </div>
        <Button
          variant="secondary"
          loading={addingSamples}
          onClick={() => void addSamples()}
          icon={<Sparkles className="h-4 w-4" />}
        >
          Add sample documents
        </Button>
      </header>

      <UploadZone
        maxBytes={limits.maxBytes}
        maxLabel={limits.label}
        onStarted={() => setUploading(true)}
        onFinished={onUploadFinished}
      />

      <GlassCard>
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-1.5">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                aria-pressed={filter === item.key}
                className={tw(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60",
                  filter === item.key
                    ? "border-crimson-600/50 bg-crimson-900/40 text-white"
                    : "border-white/10 bg-white/[0.03] text-neutral-400 hover:border-white/25 hover:text-white",
                )}
              >
                {item.label}
                <span className={tw("tabular-nums", filter === item.key ? "text-crimson-300" : "text-neutral-600")}>{item.count}</span>
              </button>
            ))}
          </div>
          <div className="relative sm:ml-auto sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents by name"
              aria-label="Search documents"
              className="h-10 w-full rounded-xl border border-white/10 bg-ink-900/80 pl-9 pr-9 text-sm text-white transition placeholder:text-neutral-500 focus:border-crimson-500/60 focus:outline-none focus:ring-2 focus:ring-crimson-600/20"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <TriangleAlert className="h-6 w-6 text-crimson-400" />
            <p className="text-sm text-neutral-300">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void refresh()}>
              Retry
            </Button>
          </div>
        ) : loading && !documents ? (
          <div className="p-4">
            <ListSkeleton rows={4} />
          </div>
        ) : documents && documents.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Files />}
              title="Your library is empty"
              description="Upload PDF documents to build your knowledge base. DocuMind extracts the text page by page, splits it into chunks, embeds it and indexes it for retrieval."
              actions={
                <>
                  <Button onClick={() => void addSamples()} loading={addingSamples} icon={<Sparkles className="h-4 w-4" />}>
                    Add sample documents
                  </Button>
                  <ButtonLink variant="secondary" href="/dashboard/assistant" icon={<FileSearch className="h-4 w-4" />}>
                    Open AI assistant
                  </ButtonLink>
                </>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <FileSearch className="h-6 w-6 text-neutral-600" />
            <p className="text-sm text-neutral-300">No documents match your search.</p>
            <button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="text-xs font-medium text-crimson-300 hover:text-crimson-200">
              Clear filters
            </button>
          </div>
        ) : (
          <ul aria-label="Documents" className="scrollbar-slim max-h-[640px] divide-y divide-white/[0.06] overflow-y-auto">
            {filtered.map((document) => (
              <li key={document.id} className={tw(uploading && "opacity-90")}>
                <DocumentRow
                  document={document}
                  busy={busyId === document.id}
                  onPreview={setPreview}
                  onRetry={(d) => void retry(d)}
                  onDelete={setPendingDelete}
                />
              </li>
            ))}
          </ul>
        )}

        {documents && documents.length > 0 ? (
          <p className="flex items-center gap-2 border-t border-white/10 px-5 py-3 text-xs text-neutral-600">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[720px]">
              Only text-based PDFs are indexed. Scanned or image-only PDFs are flagged “Needs OCR” instead of producing empty results.
            </span>
            <UploadCloud className="ml-auto hidden h-3.5 w-3.5 shrink-0 sm:block" />
          </p>
        ) : null}
      </GlassCard>

      <DocumentPreview document={preview} onClose={() => setPreview(null)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        loading={deleting}
        title="Delete this document?"
        description={
          <>
            <span className="text-white">{pendingDelete?.originalName}</span> and all of its indexed vectors will be
            permanently removed. Existing answers that cited it stay in your chat history.
          </>
        }
      />
    </div>
  );
}
