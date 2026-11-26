import { CheckCircle2, Loader2, ScanLine, TriangleAlert } from "lucide-react";
import type { DocumentDto, DocumentStatus } from "@/lib/types";
import { tw } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

const LABELS: Record<DocumentStatus, string> = {
  processing: "Processing",
  indexed: "Indexed",
  error: "Error",
  needs_ocr: "Needs OCR",
};

export function StatusBadge({ status, className }: { status: DocumentStatus; className?: string }) {
  if (status === "processing") {
    return (
      <Badge variant="crimson" className={className}>
        <Loader2 className="h-3 w-3 animate-spin" />
        {LABELS.processing}
      </Badge>
    );
  }
  if (status === "indexed") {
    return (
      <Badge variant="neutral" className={tw("border-white/15 text-white", className)}>
        <CheckCircle2 className="h-3 w-3 text-crimson-300" />
        {LABELS.indexed}
      </Badge>
    );
  }
  if (status === "needs_ocr") {
    return (
      <Badge variant="outline" className={className}>
        <ScanLine className="h-3 w-3" />
        {LABELS.needs_ocr}
      </Badge>
    );
  }
  return (
    <Badge variant="solid" className={className}>
      <TriangleAlert className="h-3 w-3" />
      {LABELS.error}
    </Badge>
  );
}

const STATUS_CLASS: Record<DocumentStatus, string> = {
  indexed: "text-neutral-400",
  processing: "text-crimson-300",
  needs_ocr: "text-neutral-400",
  error: "text-crimson-300",
};

/** Secondary line under a document name: size, pages, chunks, status message. */
export function DocumentMeta({ document }: { document: DocumentDto }) {
  if (document.status === "processing") {
    return (
      <p className={tw("truncate text-xs", STATUS_CLASS.processing)}>
        {document.statusMessage ?? "Processing…"}
      </p>
    );
  }
  if (document.status === "error") {
    return (
      <p className={tw("truncate text-xs", STATUS_CLASS.error)} title={document.error ?? undefined}>
        {document.error ?? "Processing failed."}
      </p>
    );
  }
  if (document.status === "needs_ocr") {
    return (
      <p className={tw("truncate text-xs", STATUS_CLASS.needs_ocr)} title={document.statusMessage ?? undefined}>
        {document.statusMessage ?? "No extractable text found."}
      </p>
    );
  }
  return (
    <p className={tw("truncate text-xs", STATUS_CLASS.indexed)} title={document.statusMessage ?? undefined}>
      {document.statusMessage ?? `Indexed · ${document.chunkCount} chunks`}
    </p>
  );
}
