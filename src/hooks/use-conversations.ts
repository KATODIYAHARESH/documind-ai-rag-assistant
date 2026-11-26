"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConversationSummary } from "@/lib/types";
import { chatApi } from "@/services/api";

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await chatApi.listConversations();
      setConversations(res.conversations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { conversations, setConversations, error, refresh };
}
