import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NotebookPen } from "lucide-react";
import { AskTab } from "@/components/AskTab";
import { EmailTab } from "@/components/EmailTab";
import { AddNoteTab } from "@/components/AddNoteTab";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Notes Bridge — Ask Your Notes & Draft Emails with AI" },
      {
        name: "description",
        content:
          "Notes Bridge is a RAG-powered workspace to question your notes and draft verified, source-grounded emails before sending.",
      },
      { property: "og:title", content: "Notes Bridge — Ask Your Notes & Draft Emails with AI" },
      {
        property: "og:description",
        content:
          "Query your notes with retrieval-augmented search and generate verified email drafts you can review and send.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TABS = [
  { id: "ask", label: "Ask Your Notes" },
  { id: "email", label: "Draft & Send Email" },
  { id: "add", label: "Add Note" },
] as const;

function Index() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("ask");

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-5 py-12">
        <header className="mb-8">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-card">
              <NotebookPen className="size-4.5 text-primary" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">Notes Bridge</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask questions across your notes, or let the agent draft a grounded email you can review
            before sending.
          </p>
        </header>

        <nav
          role="tablist"
          aria-label="Notes Bridge sections"
          className="mb-8 inline-flex rounded-lg border border-border bg-card/50 p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section hidden={tab !== "ask"}>{tab === "ask" && <AskTab />}</section>
        <section hidden={tab !== "email"}>{tab === "email" && <EmailTab />}</section>
        <section hidden={tab !== "add"}>{tab === "add" && <AddNoteTab />}</section>
      </div>
    </main>
  );
}
