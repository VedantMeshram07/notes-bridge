import { useState, type FormEvent } from "react";
import {
  Loader2,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Send,
  MessageSquare,
  ListTree,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SourcesPanel } from "@/components/SourcesPanel";
import { emailAgent, sendEmail, isValidEmail, type EmailAgentResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

export function EmailTab() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [agent, setAgent] = useState<EmailAgentResponse | null>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState("");

  const [traceOpen, setTraceOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || drafting) return;

    setDrafting(true);
    setDraftError(null);
    setSendError(null);
    setSentId(null);
    try {
      const res = await emailAgent(q, sessionId);
      setSessionId(res.sessionId);
      setHistory((h) => [...h, q]);
      setQuestion("");
      setAgent(res);
      setSubject(res.draft?.subject ?? "");
      setBody(res.draft?.body ?? "");
      setRecipient(res.recipientEmail ?? "");
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDrafting(false);
    }
  }

  async function onSend() {
    if (!isValidEmail(recipient) || sending) return;
    setSending(true);
    setSendError(null);
    setSentId(null);
    try {
      const res = await sendEmail(recipient.trim(), subject, body);
      if (res.error) throw new Error(res.error);
      setSentId(res.id ?? "");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  }

  const canSend = isValidEmail(recipient) && !sending;

  return (
    <div className="space-y-6">
      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card/40 p-4 shadow-sm">
          <p className="mb-2.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <MessageSquare className="size-3.5" /> This session
          </p>
          <ol className="space-y-1.5">
            {history.map((q, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground"
              >
                <span className="shrink-0 font-mono text-xs text-foreground/40">{i + 1}</span>
                <span className="truncate">{q}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <form onSubmit={onGenerate} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            history.length
              ? "Follow up — refine the draft…"
              : "Describe the email you need from your notes…"
          }
          className="h-11"
          aria-label="Email request"
        />
        <Button type="submit" disabled={drafting || !question.trim()} className="h-11 sm:w-44">
          {drafting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Drafting
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> Generate Draft
            </>
          )}
        </Button>
      </form>

      {draftError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-foreground">{draftError}</p>
        </div>
      )}

      {drafting && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-28 w-full" />
        </div>
      )}

      {agent && !drafting && (
        <div className="space-y-5">
          {agent.needsHumanReview ? (
            <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-warning">
                    This draft could not be fully verified against your notes — review carefully
                    before sending
                  </p>
                  {agent.verification?.issues?.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {agent.verification.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : agent.revisionCount === 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" /> Verified on first pass
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-info/40 bg-info/10 px-3 py-1 text-xs font-medium text-info">
              <RefreshCw className="size-3.5" /> Verified after {agent.revisionCount} correction
              {agent.revisionCount === 1 ? "" : "s"}
            </span>
          )}

          <div className="space-y-4 rounded-lg border border-border bg-card p-5">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Body</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-56 leading-relaxed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipient">
                Recipient email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="recipient"
                type="email"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="name@example.com"
              />
              {recipient.trim() !== "" && !isValidEmail(recipient) && (
                <p className="text-xs text-destructive">Enter a valid email address.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button onClick={onSend} disabled={!canSend} className="h-11">
                {sending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Sending
                  </>
                ) : (
                  <>
                    <Send className="size-4" /> Send Email
                  </>
                )}
              </Button>
              {sentId !== null && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                  <CheckCircle2 className="size-4" /> Email sent
                  {sentId && <span className="font-mono text-xs text-muted-foreground">#{sentId}</span>}
                </span>
              )}
              {sendError && (
                <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="size-4" /> {sendError}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 shadow-sm">
            <button
              type="button"
              onClick={() => setTraceOpen((v) => !v)}
              aria-expanded={traceOpen}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/30"
            >
              <ChevronRight
                className={cn(
                  "size-4 text-muted-foreground transition-transform",
                  traceOpen && "rotate-90",
                )}
              />
              Agent Trace
            </button>
            {traceOpen && (
              <ol className="relative space-y-5 border-t border-border px-4 py-5 text-sm">
                <li className="flex gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
                    <ListTree className="size-3.5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Sub-questions
                    </p>
                    {agent.subQuestions?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {agent.subQuestions.map((q, i) => (
                          <span
                            key={i}
                            className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            {q}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">None</p>
                    )}
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
                    <RefreshCw className="size-3.5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Revisions
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                        agent.revisionCount === 0
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-info/40 bg-info/10 text-info",
                      )}
                    >
                      {agent.revisionCount === 0
                        ? "Grounded on first pass"
                        : `${agent.revisionCount} correction${agent.revisionCount === 1 ? "" : "s"} made`}
                    </span>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50">
                    {agent.needsHumanReview ? (
                      <AlertTriangle className="size-3.5 text-warning" />
                    ) : (
                      <CheckCircle2 className="size-3.5 text-success" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Verification
                    </p>
                    <div
                      className={cn(
                        "rounded-lg border bg-card/60 p-3 shadow-sm",
                        agent.needsHumanReview
                          ? "border-l-4 border-border border-l-warning"
                          : "border-border",
                      )}
                    >
                      <p className="leading-relaxed text-muted-foreground">
                        {agent.verification?.summary || "—"}
                      </p>
                      {agent.needsHumanReview && agent.verification?.issues?.length > 0 && (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                          {agent.verification.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </li>
              </ol>
            )}
          </div>

          <SourcesPanel sources={agent.sources ?? []} />
        </div>
      )}
    </div>
  );
}
