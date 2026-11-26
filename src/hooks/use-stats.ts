"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardStats } from "@/lib/types";
import { dashboardApi } from "@/services/api";

export function useStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setStats(await dashboardApi.stats());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load statistics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, error, loading, refresh };
}
