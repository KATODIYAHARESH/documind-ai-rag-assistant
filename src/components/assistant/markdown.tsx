"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { tw } from "@/lib/format";

/** Rewrites [S1] citation tags into links so they render as interactive source chips. */
function linkifyCitations(text: string): string {
  return text.replace(/\[(S\d+)\]/g, (_match, tag: string) => `[\\[${tag}\\]](#cite-${tag.toLowerCase()})`);
}

function extractText(node: ReactNode): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    return extractText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = useMemo(() => extractText(children).replace(/\n$/, ""), [children]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-ink-950/85">
      <div className="flex items-center justify-between border-b border-white/10 py-1 pl-3 pr-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Code</span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? "Copied" : "Copy code"}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-neutral-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60"
        >
          {copied ? <Check className="h-3 w-3 text-crimson-300" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scrollbar-slim overflow-x-auto p-3 text-[13px] leading-relaxed text-neutral-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

interface MarkdownProps {
  text: string;
  onCitation?: (tag: string) => void;
  className?: string;
}

/** GitHub-flavoured Markdown with fenced code blocks, tables and citation chips. */
export const Markdown = memo(function Markdown({ text, onCitation, className }: MarkdownProps) {
  const components = useMemo<Components>(
    () => ({
      pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
      table: ({ children }) => (
        <div className="scrollbar-slim my-3 overflow-x-auto rounded-xl border border-white/10">
          <table>{children}</table>
        </div>
      ),
      a: ({ href, children, node: _node, ...rest }) => {
        if (href?.startsWith("#cite-")) {
          const label = extractText(children) || `#${href.slice(6).toUpperCase()}`;
          return (
            <button
              type="button"
              title={`Show source ${label}`}
              aria-label={`Show source ${label}`}
              onClick={() => onCitation?.(label.replace(/^\[|\]$/g, ""))}
              className="mx-0.5 inline-flex -translate-y-px items-center rounded-md border border-crimson-600/40 bg-crimson-900/40 px-1.5 py-px align-baseline text-[11px] font-semibold leading-5 text-crimson-200 no-underline transition hover:border-crimson-400/70 hover:bg-crimson-800/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson-400/60"
            >
              {label}
            </button>
          );
        }
        return (
          <a {...rest} href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        );
      },
    }),
    [onCitation],
  );

  return (
    <div className={tw("markdown-body", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {linkifyCitations(text)}
      </ReactMarkdown>
    </div>
  );
});
