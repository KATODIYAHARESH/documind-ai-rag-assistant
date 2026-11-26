"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { SafeUser } from "@/lib/types";
import { useAuth } from "@/context/auth";
import { authApi } from "@/services/api";
import { getStoredToken } from "@/services/session-token";
import { Logo, LogoMark } from "@/components/ui/logo";
import { Ambient } from "@/components/ambient";
import { AppShell } from "./shell";

function FullScreenLoader() {
  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <Ambient />
      <div className="relative flex flex-col items-center gap-4">
        <span className="relative">
          <span className="absolute inset-0 rounded-full bg-crimson-600/50 blur-2xl" aria-hidden />
          <LogoMark className="relative h-12 w-12" />
        </span>
        <p className="text-sm text-neutral-400">Preparing your workspace…</p>
      </div>
      <span className="sr-only">
        <Logo />
      </span>
    </div>
  );
}

/**
 * Rendered by the protected layout when the request carried no session cookie.
 * Resolves the session from the stored bearer token; otherwise sends the visitor to /login.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { updateUser } = useAuth();
  const router = useRouter();
  const [user, setUser] = useState<SafeUser | null>(null);

  useEffect(() => {
    let active = true;
    if (!getStoredToken()) {
      router.replace("/login");
      return () => {
        active = false;
      };
    }
    authApi
      .me()
      .then((res) => {
        if (!active) return;
        updateUser(res.user);
        setUser(res.user);
      })
      .catch(() => {
        if (!active) return;
        router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [updateUser, router]);

  if (user) return <AppShell user={user}>{children}</AppShell>;
  return <FullScreenLoader />;
}
