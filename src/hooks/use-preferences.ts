"use client";

import { useCallback, useEffect, useState } from "react";

export interface Preferences {
  enterToSend: boolean;
  showRetrieval: boolean;
}

const STORAGE_KEY = "documind.preferences";
export const DEFAULT_PREFERENCES: Preferences = { enterToSend: true, showRetrieval: true };

function isPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.enterToSend === "boolean" && typeof v.showRetrieval === "boolean";
}

/** Client-side application preferences, persisted in localStorage. */
export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isPreferences(parsed)) setPrefs(parsed);
      }
    } catch {
      // Ignore corrupted storage and keep defaults.
    }
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage may be unavailable (private mode).
      }
      return next;
    });
  }, []);

  return { prefs, update, ready };
}
