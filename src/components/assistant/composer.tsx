"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { tw } from "@/lib/format";
import { Button } from "@/components/ui/button";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled: boolean;
  enterToSend: boolean;
  scopeLabel: string;
}

const MAX_LENGTH = 2000;

/** Question input with auto-resize, keyboard submit, send and stop controls. */
export function Composer({ value, onChange, onSend, onStop, streaming, disabled, enterToSend, scopeLabel }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming || disabled) return;
    onSend(text);
    onChange("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    const command = event.metaKey || event.ctrlKey;
    if (enterToSend || command) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="glass-strong shrink-0 border-t border-white/10 px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto w-full max-w-[860px]">
        <div className="glass-strong flex items-end gap-2 rounded-2xl p-1.5 transition-[border-color,box-shadow] duration-200 focus-within:shadow-crimson">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(event) => onChange(event.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={onKeyDown}
            maxLength={MAX_LENGTH}
            placeholder={disabled ? "Index a document to start asking questions…" : "Ask anything about your documents…"}
            aria-label="Question for the assistant"
            className="scrollbar-slim max-h-[200px] min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-white placeholder:text-neutral-500 focus:outline-none"
          />
          {streaming ? (
            <Button size="icon" variant="secondary" onClick={onStop} aria-label="Stop generating" title="Stop generating">
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button size="icon" onClick={submit} disabled={!value.trim() || disabled} aria-label="Send question" title="Send question">
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 px-2 text-[11px] text-neutral-600">
          <span className={tw("truncate", disabled && "text-crimson-300/80")}>{scopeLabel}</span>
          <span className="hidden sm:block">{enterToSend ? "Enter to send · Shift + Enter for a new line" : "Ctrl / Cmd + Enter to send"}</span>
          <span className="shrink-0 tabular-nums">{value.length}/{MAX_LENGTH}</span>
        </div>
      </div>
    </div>
  );
}
