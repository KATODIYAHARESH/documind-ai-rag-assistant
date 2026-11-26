"use client";

import Link from "next/link";
import { FileText, MessageSquare, Plus, Trash2, X } from "lucide-react";
import type { ConversationSummary, DocumentDto } from "@/lib/types";
import { formatRelativeTime, tw } from "@/lib/format";
import { Toggle } from "@/components/ui/input";
import { StatusBadge } from "@/components/document-status";

interface ConversationPanelProps {
  documents: DocumentDto[] | null;
  allDocuments: boolean;
  onAllDocuments: (next: boolean) => void;
  selectedIds: string[];
  onToggleDocument: (id: string) => void;
  conversations: ConversationSummary[] | null;
  activeId: string | null;
  disabled: boolean;
  onDelete: (conversation: ConversationSummary) => void;
  onClose?: () => void;
}

/** Left panel: knowledge-base scope selector and conversation history. */
export function ConversationPanel(props: ConversationPanelProps) {
  const { documents, allDocuments, onAllDocuments, selectedIds, onToggleDocument, conversations, activeId, disabled, onDelete, onClose } = props;
  const indexed = documents?.filter((d) => d.status === "indexed") ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className={tw("flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3")}>
        <Link
          href="/dashboard/assistant"
          onClick={onClose}
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-crimson-500/30 bg-linear-to-b from-crimson-600 to-crimson-800 px-3 text-sm font-medium text-white shadow-[0_8px_24px_-10px_rgba(220,38,38,0.7)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-white/10 hover:text-white xl:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Knowledge base</p>
        <div className="mt-1">
          <Toggle
            checked={allDocuments}
            onChange={onAllDocuments}
            label="Search all documents"
            description={`${indexed.length} indexed document${indexed.length === 1 ? "" : "s"}`}
          />
        </div>
        {documents && documents.length > 0 ? (
          <ul className="mt-1 max-h-[220px] divide-y divide-white/[0.05] overflow-y-auto" aria-label="Documents in knowledge base">
            {documents.map((document) => {
              const ready = document.status === "indexed";
              const checked = allDocuments || selectedIds.includes(document.id);
              return (
                <li key={document.id}>
                  <label
                    className={tw(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/[0.04]",
                      (!ready || disabled || allDocuments) && "cursor-default",
                      !ready && "opacity-60",
                    )}
                    title={ready ? document.originalName : `${document.originalName} — not indexed yet`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!ready || disabled || allDocuments}
                      onChange={() => onToggleDocument(document.id)}
                      className="h-4 w-4 shrink-0 cursor-inherit rounded border-white/25 accent-crimson-600"
                    />
                    <FileText className="h-3.5 w-3.5 shrink-0 text-neutral-600" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-300">{document.originalName.replace(/\.pdf$/i, "")}</span>
                    {ready ? null : <StatusBadge status={document.status} />}
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-neutral-600">
            No documents yet. Upload a PDF under My Documents to build your knowledge base.
          </p>
        )}
      </div>

      <p className="flex shrink-0 items-center justify-between px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
        Chat history
        {conversations && conversations.length > 0 ? <span className="tabular-nums text-neutral-600">{conversations.length}</span> : null}
      </p>
      <div className="scrollbar-slim flex-1 overflow-y-auto px-2 pb-3">
        {conversations === null ? (
          <div className="flex flex-col gap-1.5 p-2" aria-busy aria-label="Loading conversations">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-11" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2.5 py-2 text-xs leading-relaxed text-neutral-600">Your saved conversations will appear here.</p>
        ) : (
          <ul aria-label="Conversations">
            {conversations.map((conversation) => {
              const active = conversation.id === activeId;
              return (
                <li key={conversation.id} className="group relative">
                  <Link
                    href={`/dashboard/assistant?c=${conversation.id}`}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={tw(
                      "flex items-center gap-2.5 rounded-xl py-2 pl-2.5 pr-9 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60",
                      active ? "bg-white/[0.07] text-white" : "text-neutral-400 hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    <MessageSquare className={tw("h-4 w-4 shrink-0", active ? "text-crimson-400" : "text-neutral-600")} strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate">{conversation.title || "Untitled conversation"}</span>
                    <span className="shrink-0 text-[11px] text-neutral-600">{formatRelativeTime(conversation.updatedAt)}</span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete conversation "${conversation.title}"`}
                    title="Delete conversation"
                    disabled={disabled}
                    onClick={() => onDelete(conversation)}
                    className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 opacity-0 transition hover:bg-crimson-900/40 hover:text-crimson-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60 group-hover:opacity-100 disabled:opacity-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
