import { useState, type FormEvent } from "react";
import { Loader2, Search, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SourcesPanel } from "@/components/SourcesPanel";
import { ragQuery, type RagResponse } from "@/lib/api";

export function AskTab() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RagResponse | null>(null);
  const [asked, setAsked] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setAsked(q);
    try {
      setResult(await ragQuery(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about your notes…"
          className="h-11"
          aria-label="Your question"
        />
        <Button type="submit" disabled={loading || !question.trim()} className="h-11 sm:w-40">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Searching
            </>
          ) : (
            <>
              <Search className="size-4" /> Ask
            </>
          )}
        </Button>
      </form>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {asked && (
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground/70">Question:</span> {asked}
            </p>
          )}
          <article className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            {result.answer
              .split(/\n\s*\n/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p, i) => (
                <p key={i} className="whitespace-pre-wrap text-[15px] leading-7 text-card-foreground">
                  {p}
                </p>
              ))}
          </article>
          <SourcesPanel sources={result.sources ?? []} />
        </div>
      )}
    </div>
  );
}
