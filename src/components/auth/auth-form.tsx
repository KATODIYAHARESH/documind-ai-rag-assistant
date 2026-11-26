"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Eye, EyeOff } from "lucide-react";
import type { SafeUser } from "@/lib/types";
import { ApiError, authApi } from "@/services/api";
import { getStoredToken, storeToken } from "@/services/session-token";
import { useToast } from "@/context/toast";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

interface AuthFormProps {
  mode: "login" | "signup";
}

const COPY = {
  login: {
    heading: "Welcome back",
    sub: "Log in to your document intelligence workspace.",
    submit: "Log in",
    switch: "New to DocuMind AI?",
    switchLabel: "Create an account",
    href: "/signup",
    success: "Signed in",
  },
  signup: {
    heading: "Create your workspace",
    sub: "Turn your first PDF into a knowledge base in minutes.",
    submit: "Create account",
    switch: "Already have an account?",
    switchLabel: "Log in",
    href: "/login",
    success: "Account created",
  },
} as const;

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const copy = COPY[mode];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverErrorCode, setServerErrorCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resuming, setResuming] = useState(false);

  const destination = (): string => {
    const next = searchParams.get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  };

  // Already signed in (a session token from a previous visit)? Go straight to the workspace.
  useEffect(() => {
    if (!getStoredToken()) return;
    let active = true;
    setResuming(true);
    authApi
      .me()
      .then((res: { user: SafeUser }) => {
        if (!active) return;
        router.replace(destination());
      })
      .catch(() => {
        if (!active) return;
        storeToken(null);
        setResuming(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (mode === "signup" && name.trim().length < 2) next.name = "Enter your name (at least 2 characters).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (mode === "signup" && password.length < 8) next.password = "Use at least 8 characters.";
    if (mode === "login" && password.length === 0) next.password = "Enter your password.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setServerErrorCode(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await authApi.register({ name: name.trim(), email: email.trim(), password });
      } else {
        await authApi.login({ email: email.trim(), password });
      }
      toast({ variant: "success", title: copy.success, description: "Opening your workspace…" });
      router.replace(destination());
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setServerErrorCode(err instanceof ApiError ? (err.code ?? null) : null);
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">{copy.heading}</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">{copy.sub}</p>
      </div>

      <form onSubmit={submit} noValidate className="glass flex flex-col gap-4 rounded-3xl p-6 shadow-glass sm:p-8">
        {mode === "signup" ? (
          <Field label="Full name" error={errors.name}>
            {(id) => (
              <Input
                id={id}
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Amara Chen"
                maxLength={60}
                aria-invalid={Boolean(errors.name)}
              />
            )}
          </Field>
        ) : null}

        <Field label="Email" error={errors.email}>
          {(id) => (
            <Input
              id={id}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              maxLength={254}
              aria-invalid={Boolean(errors.email)}
            />
          )}
        </Field>

        <Field
          label="Password"
          error={errors.password}
          hint={mode === "signup" ? "At least 8 characters. Stored only as a scrypt hash." : undefined}
        >
          {(id) => (
            <div className="relative">
              <Input
                id={id}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
                maxLength={128}
                className="pr-11"
                aria-invalid={Boolean(errors.password)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 transition hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}
        </Field>

        {serverError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-crimson-700/40 bg-crimson-950/50 px-3.5 py-2.5 text-sm leading-relaxed text-crimson-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-crimson-300" />
            <div className="min-w-0">
              <p>{serverError}</p>
              {serverErrorCode === "unknown_email" || serverErrorCode === "email_taken" ? (
                <Link
                  href={serverErrorCode === "unknown_email" ? "/signup" : "/login"}
                  className="mt-1.5 inline-flex items-center gap-1 font-medium text-crimson-300 underline-offset-4 transition hover:text-white hover:underline"
                >
                  {serverErrorCode === "unknown_email" ? "Create an account instead" : "Log in to your account"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <Button type="submit" size="lg" loading={submitting || resuming} className="mt-1 w-full">
          {copy.submit}
          {!submitting && !resuming ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        {copy.switch}{" "}
        <Link href={copy.href} className="font-medium text-crimson-300 underline-offset-4 transition hover:text-white hover:underline">
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  );
}
