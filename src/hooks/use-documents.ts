"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentDto } from "@/lib/types";
import { documentsApi } from "@/services/api";

/** Loads the user's documents and polls while any of them is processing. */
export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await documentsApi.list();
      setDocuments(res.documents);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const processing = documents?.some((d) => d.status === "processing") ?? false;

  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(timer);
  }, [processing, refresh]);

  return { documents, setDocuments, loading, error, refresh };
}
