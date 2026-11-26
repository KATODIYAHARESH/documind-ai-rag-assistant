"use client";

import { useState } from "react";
import { Eye, FileText, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import type { DocumentDto } from "@/lib/types";
import { formatBytes, formatRelativeTime, tw } from "@/lib/format";
import { DocumentMeta, StatusBadge } from "@/components/document-status";
import { Button } from "@/components/ui/button";

interface DocumentRowProps {
  document: DocumentDto;
  onPreview: (document: DocumentDto) => void;
  onRetry: (document: DocumentDto) => void;
  onDelete: (document: DocumentDto) => void;
  busy?: boolean;
}

function IconAction({
  label,
  onClick,
  children,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={tw(
        "flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60 disabled:opacity-40",
        danger ? "hover:bg-crimson-900/40 hover:text-crimson-300" : "hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

export function DocumentRow({ document, onPreview, onRetry, onDelete, busy }: DocumentRowProps) {
  const [menu, setMenu] = useState(false);
  const canRetry = document.status === "error" || document.status === "needs_ocr";

  return (
    <div className="group grid gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-crimson-300">
          <FileText className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white" title={document.originalName}>
            {document.originalName}
          </p>
          <DocumentMeta document={document} />
        </div>
        <div className="sm:hidden">
          <StatusBadge status={document.status} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="hidden items-center gap-5 text-xs text-neutral-500 md:flex">
          <span className="w-14">{formatBytes(document.sizeBytes)}</span>
          <span className="w-14">{document.pageCount ? `${document.pageCount} pg` : "—"}</span>
          <span className="w-16">{document.status === "indexed" ? `${document.chunkCount} chunks` : "—"}</span>
          <span className="w-20 text-right">{formatRelativeTime(document.createdAt)}</span>
        </div>
        <div className="hidden sm:block">
          <StatusBadge status={document.status} />
        </div>

        <div className="flex items-center gap-0.5 sm:hidden">
          <div className="relative">
            <IconAction label="More actions" onClick={() => setMenu((v) => !v)}>
              <MoreHorizontal className="h-4 w-4" />
            </IconAction>
            {menu ? (
              <>
                <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
                <div className="glass-strong absolute right-0 z-20 mt-1 flex w-44 flex-col rounded-xl p-1.5 shadow-glass">
                  <button type="button" className="rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/10" onClick={() => { setMenu(false); onPreview(document); }}>
                    Preview PDF
                  </button>
                  {canRetry ? (
                    <button type="button" className="rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/10" onClick={() => { setMenu(false); onRetry(document); }}>
                      Retry processing
                    </button>
                  ) : null}
                  <button type="button" className="rounded-lg px-3 py-2 text-left text-sm text-crimson-300 hover:bg-crimson-900/30" onClick={() => { setMenu(false); onDelete(document); }}>
                    Delete document
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="hidden items-center gap-0.5 sm:flex">
          <IconAction label="Preview PDF" onClick={() => onPreview(document)}>
            <Eye className="h-4 w-4" />
          </IconAction>
          {canRetry ? (
            <IconAction label="Retry processing" onClick={() => onRetry(document)} disabled={busy}>
              <RotateCcw className={tw("h-4 w-4", busy && "animate-spin")} />
            </IconAction>
          ) : null}
          <IconAction label="Delete document" onClick={() => onDelete(document)} danger>
            <Trash2 className="h-4 w-4" />
          </IconAction>
        </div>
      </div>
    </div>
  );
}

export function RetryButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <Button size="sm" variant="secondary" icon={<RotateCcw className={tw("h-3.5 w-3.5", loading && "animate-spin")} />} loading={loading} onClick={onClick}>
      Retry processing
    </Button>
  );
}
