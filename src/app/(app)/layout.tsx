import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthProvider } from "@/context/auth";
import { AppShell } from "@/components/app/shell";
import { AuthGuard } from "@/components/app/auth-guard";

export const dynamic = "force-dynamic";

/**
 * Protected area: every route in this group requires an authenticated session.
 * The session normally arrives as an httpOnly cookie. When the browser refuses the
 * cookie (embedded cross-site views), the AuthGuard resolves it from the stored
 * bearer token instead — so the workspace works in both cases.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (user) {
    return (
      <AuthProvider initialUser={user}>
        <AppShell user={user}>{children}</AppShell>
      </AuthProvider>
    );
  }
  return (
    <AuthProvider initialUser={null}>
      <AuthGuard>{children}</AuthGuard>
    </AuthProvider>
  );
}
