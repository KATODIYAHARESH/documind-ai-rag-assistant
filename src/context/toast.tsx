"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type Variant = "success" | "error" | "info";

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: Variant;
}

interface ToastApi {
  toast: (toast: { title: string; description?: string; variant?: Variant }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS: Record<Variant, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 shrink-0 text-crimson-300" />,
  error: <AlertTriangle className="h-4 w-4 shrink-0 text-crimson-400" />,
  info: <Info className="h-4 w-4 shrink-0 text-neutral-300" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((input: { title: string; description?: string; variant?: Variant }) => {
    const id = Date.now() + Math.random();
    const variant = input.variant ?? "info";
    setToasts((prev) => [...prev.slice(-3), { id, title: input.title, description: input.description, variant }]);
    window.setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      variant === "error" ? 6500 : 3800,
    );
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              role="status"
              initial={{ opacity: 0, x: 32, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.97 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="glass-strong pointer-events-auto flex items-start gap-3 rounded-xl p-3.5 shadow-glass"
            >
              {ICONS[t.variant]}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{t.title}</p>
                {t.description ? <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">{t.description}</p> : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="rounded-md p-0.5 text-neutral-500 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
