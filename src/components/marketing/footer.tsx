import Link from "next/link";
import { Logo } from "@/components/ui/logo";

const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "RAG technology", href: "/#technology" },
    ],
  },
  {
    title: "Workspace",
    links: [
      { label: "Overview", href: "/dashboard" },
      { label: "My Documents", href: "/dashboard/documents" },
      { label: "AI Assistant", href: "/dashboard/assistant" },
      { label: "Chat History", href: "/dashboard/history" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Log in", href: "/login" },
      { label: "Create account", href: "/signup" },
      { label: "Settings", href: "/dashboard/settings" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" aria-label="DocuMind AI home">
            <Logo />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-500">
            Your Documents. Your Intelligence. Source-cited answers from the knowledge you already own.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{column.title}</h3>
            <ul className="mt-4 flex flex-col gap-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-neutral-400 transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-xs text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} DocuMind AI. All rights reserved.</p>
          <p>Retrieval-augmented generation · PostgreSQL vector store · OpenAI-compatible LLM</p>
        </div>
      </div>
    </footer>
  );
}
