"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, History, LayoutDashboard, LogOut, Menu, ScanText, Settings, Sparkles, X } from "lucide-react";
import type { DocumentDto, PublicConfig, SafeUser } from "@/lib/types";
import { initials, truncate, tw } from "@/lib/format";
import { useAuth } from "@/context/auth";
import { useDocuments } from "@/hooks/use-documents";
import { configApi } from "@/services/api";
import { Logo } from "@/components/ui/logo";
import { Ambient } from "@/components/ambient";
import { ButtonLink } from "@/components/ui/button";
import { NAV, isActivePath } from "./nav";

const ICONS = [LayoutDashboard, FileText, Sparkles, History, Settings];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="mt-1 flex flex-col gap-1 px-3">
      {NAV.map((item, index) => {
        const Icon = ICONS[index];
        const active = isActivePath(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={tw(
              "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60",
              active ? "bg-white/[0.07] text-white" : "text-neutral-400 hover:bg-white/[0.04] hover:text-white",
            )}
          >
            {active ? (
              <motion.span
                layoutId="nav-active-glow"
                className="absolute -left-3 bottom-2 top-2 w-[3px] rounded-full bg-crimson-400 shadow-[0_0_14px_rgba(255,69,69,0.9)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <Icon
              className={tw("h-[18px] w-[18px] transition-colors", active ? "text-crimson-400" : "text-neutral-500 group-hover:text-neutral-300")}
              strokeWidth={1.75}
            />
            <span>{item.label}</span>
            {item.href === "/dashboard/assistant" ? (
              <span className="ml-auto rounded-full border border-crimson-600/35 bg-crimson-900/30 px-1.5 text-[10px] font-semibold tracking-wider text-crimson-300">
                RAG
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function RecentDocuments({ onNavigate }: { onNavigate?: () => void }) {
  const { documents } = useDocuments();
  const indexed = documents?.filter((d) => d.status === "indexed").slice(0, 6) ?? [];
  return (
    <div className="mt-3 flex flex-col gap-0.5 px-3">
      {indexed.length === 0 ? (
        <p className="px-3 pb-2 text-xs leading-relaxed text-neutral-600">
          Indexed documents appear here for quick, scoped questions.
        </p>
      ) : (
        indexed.map((doc: DocumentDto) => (
          <Link
            key={doc.id}
            href={`/dashboard/assistant?doc=${doc.id}`}
            onClick={onNavigate}
            title={`Ask about ${doc.originalName}`}
            className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] text-neutral-400 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60"
          >
            <FileText className="h-4 w-4 shrink-0 text-neutral-600" strokeWidth={1.75} />
            <span className="truncate">{truncate(doc.originalName.replace(/\.pdf$/i, ""), 30)}</span>
          </Link>
        ))
      )}
    </div>
  );
}

function SidebarBody({ user, onNavigate }: { user: SafeUser; onNavigate?: () => void }) {
  const { logout } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center px-5">
        <Link href="/dashboard" onClick={onNavigate} aria-label="DocuMind AI overview">
          <Logo />
        </Link>
      </div>
      <NavLinks onNavigate={onNavigate} />
      <div className="mx-5 my-4 h-px bg-white/10" />
      <p className="flex items-center gap-2 px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
        <ScanText className="h-3.5 w-3.5" />
        Knowledge base
      </p>
      <div className="scrollbar-slim mt-3 flex-1 overflow-y-auto pb-3">
        <RecentDocuments onNavigate={onNavigate} />
      </div>
      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-2.5 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-crimson-600 to-crimson-900 text-xs font-semibold text-white ring-1 ring-crimson-400/40">
            {initials(user.name) || "D"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{user.name}</p>
            <p className="truncate text-[11px] text-neutral-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            title="Log out"
            aria-label="Log out"
            className="rounded-lg p-2 text-neutral-500 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const current = NAV.find((item) => isActivePath(pathname, item.href, item.exact));

  useEffect(() => {
    document.title = `${current?.label ?? "Workspace"} · DocuMind AI`;
  }, [current?.label]);

  useEffect(() => {
    let active = true;
    configApi
      .get()
      .then((c) => {
        if (active) setConfig(c);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const generative = config?.llm.configured ?? false;

  return (
    <header className="glass-strong sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
        className="rounded-lg p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="text-[15px] font-semibold text-white">{current?.label ?? "Workspace"}</h1>
      <div className="ml-auto flex items-center gap-2">
        {config ? (
          <span
            title={
              generative
                ? `Answers generated by ${config.llm.model}`
                : "No LLM API key configured: answers are grounded extracts from your documents."
            }
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300 sm:inline-flex"
          >
            <span
              className={tw(
                "h-1.5 w-1.5 rounded-full",
                generative ? "bg-crimson-400 shadow-[0_0_8px_rgba(255,69,69,0.9)]" : "bg-neutral-500",
              )}
            />
            {generative ? config.llm.model : "Extractive mode"}
          </span>
        ) : null}
        <ButtonLink href="/dashboard/assistant" size="sm" icon={<Sparkles className="h-4 w-4" />}>
          <span className="hidden sm:inline">Ask AI</span>
        </ButtonLink>
      </div>
    </header>
  );
}

export function AppShell({ user, children }: { user: SafeUser; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const workspace = pathname.startsWith("/dashboard/assistant");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="relative flex min-h-screen">
      <Ambient />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-white/10 bg-ink-850/95 lg:block">
        <SidebarBody user={user} />
      </aside>
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              key="nav-overlay"
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              key="nav-drawer"
              className="fixed inset-y-0 left-0 z-50 w-[284px] border-r border-white/10 bg-ink-850 lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="absolute right-3 top-3.5 z-10 rounded-lg p-2 text-neutral-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarBody user={user} onNavigate={() => setOpen(false)} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
      <div className="flex min-h-screen w-full min-w-0 flex-col lg:pl-[264px]">
        <Topbar onMenu={() => setOpen(true)} />
        <main
          className={tw(
            "mx-auto flex w-full max-w-[1400px] flex-1",
            workspace ? "h-[calc(100vh-56px)] min-h-[520px] overflow-hidden" : "px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
