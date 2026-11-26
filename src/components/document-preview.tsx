"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { authHeaders } from "@/services/session-token";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

/** Minimal document shape needed to open a preview (a full DocumentDto also fits). */
export interface PreviewDocument {
  id: string;
  originalName: string;
  pageCount: number | null;
  chunkCount: number;
}

interface DocumentPreviewProps {
  document: PreviewDocument | null;
  page?: number;
  onClose: () => void;
}

/**
 * In-app PDF preview. The file is fetched with the session (cookie or bearer token) and
 * shown through an object URL, so it works in embedded views as well.
 */
export function DocumentPreview({ document, page, onClose }: DocumentPreviewProps) {
  const documentId = document?.id ?? null;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setObjectUrl(null);
    setFailed(false);
    if (!documentId) return;
    let active = true;
    let created: string | null = null;
    fetch(`/api/documents/${documentId}/file`, { credentials: "include", headers: authHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [documentId]);

  if (!document) return null;
  const viewUrl = objectUrl ? `${objectUrl}${page ? `#page=${page}` : ""}` : null;

  return (
    <Modal open onClose={onClose} size="xl" title={document.originalName} bodyClassName="p-0">
      <div className="flex h-[72vh] min-h-[320px] flex-col">
        {viewUrl ? (
          <iframe
            key={viewUrl}
            src={viewUrl}
            title={`Preview of ${document.originalName}`}
            className="h-full w-full flex-1 rounded-b-2xl bg-ink-900"
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            {failed ? (
              <>
                <AlertTriangle className="h-6 w-6 text-crimson-400" />
                <p className="text-sm text-neutral-300">This PDF could not be loaded. Close the preview and try again.</p>
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-crimson-400" />
                <p className="text-sm text-neutral-400">Loading PDF…</p>
              </>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-2.5">
          <p className="truncate text-xs text-neutral-500">
            {document.pageCount ?? "—"} pages · {document.chunkCount} indexed chunks
            {page ? ` · page ${page}` : ""}
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={!viewUrl}
            icon={<ExternalLink className="h-3.5 w-3.5" />}
            onClick={() => {
              if (viewUrl) window.open(viewUrl, "_blank", "noopener");
            }}
          >
            Open in new tab
          </Button>
        </div>
      </div>
    </Modal>
  );
}
