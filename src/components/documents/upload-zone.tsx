"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { motion } from "framer-motion";
import { FileUp, UploadCloud } from "lucide-react";
import { tw } from "@/lib/format";
import { useToast } from "@/context/toast";
import { documentsApi, type UploadResult } from "@/services/api";

interface UploadZoneProps {
  maxBytes: number;
  maxLabel: string;
  onStarted?: () => void;
  onFinished?: (result: UploadResult) => void;
}

const MAX_FILES = 10;

/** Drag-and-drop + browse uploader with a real upload progress bar. */
export function UploadZone({ maxBytes, maxLabel, onStarted, onFinished }: UploadZoneProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const handleFiles = async (input: FileList | File[]) => {
    const files = Array.from(input);
    if (!files.length || progress !== null) return;

    const accepted: File[] = [];
    for (const file of files) {
      if (!/\.pdf$/i.test(file.name)) {
        toast({ variant: "error", title: "Unsupported file type", description: `${file.name} is not a PDF. Only .pdf files are supported.` });
        continue;
      }
      if (file.size > maxBytes) {
        toast({ variant: "error", title: "File too large", description: `${file.name} exceeds the ${maxLabel} limit.` });
        continue;
      }
      accepted.push(file);
    }
    if (!accepted.length) return;
    if (accepted.length > MAX_FILES) {
      toast({ variant: "error", title: "Too many files", description: `Upload at most ${MAX_FILES} PDFs at a time.` });
      return;
    }

    setProgress(0);
    onStarted?.();
    try {
      const result = await documentsApi.upload(accepted, setProgress);
      if (result.documents.length > 0) {
        toast({
          variant: "success",
          title: `${result.documents.length} document${result.documents.length === 1 ? "" : "s"} queued for processing`,
          description: "Extraction, chunking and embedding finish in a few seconds. Status updates automatically.",
        });
      }
      for (const issue of result.errors ?? []) {
        toast({ variant: "error", title: issue.filename, description: issue.message });
      }
      onFinished?.(result);
    } catch (err) {
      toast({
        variant: "error",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
      onFinished?.({ documents: [] });
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void handleFiles(event.target.files);
  };

  const onDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (!dragging) setDragging(true);
  };

  const onDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) void handleFiles(event.dataTransfer.files);
  };

  const uploading = progress !== null;

  return (
    <label
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={tw(
        "glass relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all duration-200 focus-within:ring-2 focus-within:ring-crimson-400/50",
        dragging ? "border-crimson-500/70 bg-crimson-900/20" : "border-white/15 hover:border-crimson-600/50 hover:bg-white/[0.04]",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={onChange}
        disabled={uploading}
        aria-label="Upload PDF documents"
        className="sr-only"
      />
      <motion.span
        animate={dragging ? { scale: 1.08, y: -3 } : { scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="relative"
      >
        <span className="absolute inset-0 rounded-full bg-crimson-600/40 blur-2xl" aria-hidden />
        <span className="glass-strong relative flex h-14 w-14 items-center justify-center rounded-2xl text-crimson-300">
          {uploading ? <FileUp className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" strokeWidth={1.75} />}
        </span>
      </motion.span>

      {uploading ? (
        <div className="w-full max-w-sm" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-neutral-300">
            <span>Uploading…</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-crimson-800 via-crimson-500 to-crimson-400 transition-[width] duration-200"
              style={{ width: `${Math.max(progress, 3)}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="text-[15px] font-medium text-white">Drag &amp; drop PDFs here</p>
            <p className="mt-1 text-xs text-neutral-500">
              or <span className="text-crimson-300">browse files</span> · multiple PDFs supported · up to {maxLabel} each
            </p>
          </div>
        </>
      )}
    </label>
  );
}
