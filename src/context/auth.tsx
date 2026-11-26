"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { SafeUser } from "@/lib/types";
import { authApi } from "@/services/api";
import { storeToken } from "@/services/session-token";

interface AuthState {
  user: SafeUser | null;
  logout: () => Promise<void>;
  updateUser: (user: SafeUser) => void;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * `initialUser` comes from the server when the session cookie was available. When the
 * cookie is refused (embedded cross-site views) it is null and the AuthGuard resolves
 * the session from the stored bearer token instead.
 */
export function AuthProvider({ initialUser, children }: { initialUser: SafeUser | null; children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(initialUser);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The session is rejected server-side on the next request regardless.
    }
    storeToken(null);
    setUser(null);
    window.location.href = "/login";
  }, []);

  const updateUser = useCallback((next: SafeUser) => setUser(next), []);

  const value = useMemo(() => ({ user, logout, updateUser }), [user, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
