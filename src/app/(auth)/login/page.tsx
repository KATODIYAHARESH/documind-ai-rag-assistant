import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-busy>
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      <AuthForm mode="login" />
    </Suspense>
  );
}
