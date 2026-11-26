"use client";

import { useEffect, useState } from "react";
import { Check, Database, Fingerprint, Layers, LogOut, MessageSquare, Pencil, Search, Server, ShieldCheck, Sparkles, Trash2, UploadCloud } from "lucide-react";
import type { PublicConfig } from "@/lib/types";
import { formatDateTime, initials, tw } from "@/lib/format";
import { useAuth } from "@/context/auth";
import { useToast } from "@/context/toast";
import { usePreferences } from "@/hooks/use-preferences";
import { authApi, chatApi, configApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Divider, Eyebrow, GlassCard } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { Field, Input, Toggle } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function SectionTitle({ icon: Icon, title, description }: { icon: typeof Sparkles; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-crimson-300">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div>
        <h3 className="text-[15px] font-semibold text-white">{title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{description}</p>
      </div>
    </div>
  );
}

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <span className="text-[13px] text-neutral-400">{label}</span>
      <span className={tw("text-[13px] font-medium text-white", mono && "font-mono text-[12.5px]")}>{children}</span>
    </div>
  );
}

function Pill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-neutral-200">
      <span className={tw("h-1.5 w-1.5 rounded-full", on ? "bg-crimson-400 shadow-[0_0_8px_rgba(255,69,69,0.9)]" : "bg-neutral-500")} />
      {children}
    </span>
  );
}

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const { toast } = useToast();
  const { prefs, update } = usePreferences();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [name, setName] = useState(user?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    configApi
      .get()
      .then(setConfig)
      .catch((err: unknown) => toast({ variant: "error", title: "Could not load configuration", description: err instanceof Error ? err.message : undefined }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveName = async () => {
    setSavingName(true);
    try {
      const result = await authApi.updateProfile({ name: name.trim() });
      updateUser(result.user);
      toast({ variant: "success", title: "Profile updated", description: `Display name is now ${result.user.name}.` });
    } catch (err) {
      toast({ variant: "error", title: "Could not update profile", description: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingName(false);
    }
  };

  const clearHistory = async () => {
    setClearing(true);
    try {
      const result = await chatApi.deleteAll();
      toast({ variant: "success", title: `Deleted ${result.deleted} conversation${result.deleted === 1 ? "" : "s"}` });
      setConfirmClear(false);
    } catch (err) {
      toast({ variant: "error", title: "Could not clear chat history", description: err instanceof Error ? err.message : undefined });
    } finally {
      setClearing(false);
    }
  };

  const dirty = name.trim() !== (user?.name ?? "") && name.trim().length >= 2;

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
      <header>
        <Eyebrow>Workspace</Eyebrow>
        <h2 className="mt-2 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
          Set<span className="italic text-crimson-300">tings</span>
        </h2>
        <p className="mt-2 text-sm text-neutral-400">Your profile, the AI pipeline behind your answers, and application preferences.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-5 sm:p-6">
          <SectionTitle icon={Fingerprint} title="Profile" description="How you appear across DocuMind AI." />
          <Divider className="my-4" />
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-crimson-600 to-crimson-900 text-lg font-semibold text-white ring-1 ring-crimson-400/40">
              {initials(user?.name ?? "D") || "D"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-white">{user?.name}</p>
              <p className="truncate text-xs text-neutral-500">{user?.email}</p>
              <p className="mt-0.5 text-xs text-neutral-600">Member since {user ? formatDateTime(user.createdAt) : "—"}</p>
            </div>
          </div>
          <form
            className="mt-5"
            onSubmit={(event) => {
              event.preventDefault();
              void saveName();
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <Field label="Display name" className="flex-1">
                {(id) => (
                  <Input
                    id={id}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    minLength={2}
                    maxLength={60}
                  />
                )}
              </Field>
              <Button type="submit" variant="secondary" loading={savingName} disabled={!dirty} icon={<Pencil className="h-4 w-4" />} className="sm:mt-[22px]">
                Save
              </Button>
            </div>
          </form>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <SectionTitle icon={ShieldCheck} title="Session &amp; security" description="Sign out, or clear what the assistant remembers." />
          <Divider className="my-4" />
          <div className="flex flex-col gap-3">
            <p className="text-xs leading-relaxed text-neutral-500">
              Passwords are stored as scrypt hashes and sessions live in httpOnly cookies. API keys never leave the server.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmClear(true)}>
                Delete chat history
              </Button>
              <Button variant="secondary" icon={<LogOut className="h-4 w-4" />} onClick={() => void logout()}>
                Log out
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-5 sm:p-6">
        <SectionTitle icon={Sparkles} title="AI provider" description="What generates your answers. Secrets are read from server environment variables only." />
        <Divider className="my-3" />
        {config ? (
          <div className="divide-y divide-white/[0.06]">
            <Row label="Answer generation">
              <Pill on={config.llm.configured}>{config.llm.configured ? "Generative LLM configured" : "Offline · extractive mode"}</Pill>
            </Row>
            <Row label="Provider">
              <span className="font-mono text-[12.5px]">{config.llm.provider}</span>
            </Row>
            <Row label="Model">
              <span className="font-mono text-[12.5px]">{config.llm.model}</span>
            </Row>
            {!config.llm.configured ? (
              <div className="py-3">
                <p className="rounded-xl border border-crimson-900/60 bg-crimson-950/40 px-4 py-3 text-xs leading-relaxed text-neutral-300">
                  No <code className="text-crimson-300">LLM_API_KEY</code> is configured on this server. Answers are still real RAG output: the top
                  retrieved passages are selected and quoted verbatim with their citations — nothing is generated or invented. Set{" "}
                  <code className="text-crimson-300">LLM_API_KEY</code>, <code className="text-crimson-300">LLM_MODEL</code> and{" "}
                  <code className="text-crimson-300">LLM_BASE_URL</code> (any OpenAI-compatible endpoint) to enable generative answers.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <SectionTitle icon={Database} title="Retrieval pipeline" description="Embeddings, chunking and retrieval settings currently in effect." />
        <Divider className="my-3" />
        {config ? (
          <div className="grid gap-x-10 sm:grid-cols-2">
            <div className="divide-y divide-white/[0.06]">
              <Row label="Embedding provider">
                <span className="font-mono text-[12.5px]">{config.embeddings.provider === "local" ? "local (built-in)" : config.embeddings.provider}</span>
              </Row>
              <Row label="Embedding model" mono>
                {config.embeddings.model}
              </Row>
              <Row label="Vector dimensions">
                <span className="font-mono text-[12.5px]">{config.embeddings.dimension}</span>
              </Row>
              <Row label="Vector store">
                <span className="font-mono text-[12.5px]">PostgreSQL · cosine</span>
              </Row>
            </div>
            <div className="divide-y divide-white/[0.06]">
              <Row label="Chunk size">
                <span className="font-mono text-[12.5px]">~{config.retrieval.chunkTargetTokens} tokens</span>
              </Row>
              <Row label="Chunk overlap">
                <span className="font-mono text-[12.5px]">~{config.retrieval.chunkOverlapTokens} tokens</span>
              </Row>
              <Row label="Passages per answer">
                <span className="font-mono text-[12.5px]">top {config.retrieval.topK} of {config.retrieval.candidateK} candidates</span>
              </Row>
              <Row label="Min. relevance">
                <span className="font-mono text-[12.5px]">{config.retrieval.minScore}</span>
              </Row>
              <Row label="Upload limit">
                <span className="font-mono text-[12.5px]">{config.limits.maxUploadLabel} · PDF</span>
              </Row>
              <Row label="OCR for scans">
                <span>{config.ocr.enabled ? "Enabled" : "Disabled — flagged as “Needs OCR”"}</span>
              </Row>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <SectionTitle icon={Layers} title="Application preferences" description="Stored on this device only." />
        <Divider className="my-3" />
        <div className="divide-y divide-white/[0.06]">
          <Toggle
            checked={prefs.enterToSend}
            onChange={(next) => update({ enterToSend: next })}
            label="Press Enter to send"
            description="When off, use the send button or Ctrl / Cmd + Enter."
          />
          <Toggle
            checked={prefs.showRetrieval}
            onChange={(next) => update({ showRetrieval: next })}
            label="Show retrieval details"
            description="Display relevance scores and retrieval metadata in the assistant."
          />
        </div>
      </GlassCard>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => void clearHistory()}
        loading={clearing}
        confirmLabel="Delete all"
        title="Delete your entire chat history?"
        description="All conversations and messages will be permanently removed. Your documents stay untouched."
      />

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-4 text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1.5"><Server className="h-3.5 w-3.5" /> DocuMind AI {config ? `v${config.app.version}` : ""}</span>
        <span className="inline-flex items-center gap-1.5"><Search className="h-3.5 w-3.5" /> Retrieval-augmented generation</span>
        <span className="inline-flex items-center gap-1.5"><UploadCloud className="h-3.5 w-3.5" /> PDF ingestion</span>
        <span className="inline-flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Cited answers</span>
        <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> {user?.email}</span>
      </p>
    </div>
  );
}
