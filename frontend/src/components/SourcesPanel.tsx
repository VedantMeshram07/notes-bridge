import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Source } from "@/lib/api";
import { cn } from "@/lib/utils";

function shortId(id: string) {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function SourcesPanel({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);

  if (!sources?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card/40 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/30"
        aria-expanded={open}
      >
        <ChevronRight
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-90")}
        />
        Sources
        <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {sources.length}
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-3 border-t border-border p-4 sm:grid-cols-2">
          {sources.map((s, i) => (
            <article
              key={`${s.note_id}-${i}`}
              className="relative rounded-lg border border-border/70 bg-card/60 p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    s.similarity === null
                      ? "border-info/40 bg-info/10 text-info"
                      : "border-primary/40 bg-primary/10 text-primary",
                  )}
                >
                  {s.similarity === null
                    ? "Linked note"
                    : `${Math.round(s.similarity * 100)}% match`}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70">
                  {shortId(s.note_id)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {s.excerpt}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
