# Notes Bridge

An Obsidian Vault Knowledge Base + RAG Email Sender, built for The Skillians'
Generative AI Developer Build Sprint. Ask questions across an Obsidian vault
and get answers grounded in your actual notes, or have a multi-agent pipeline
draft an email from your notes — verified against the source material and
revised automatically if it isn't — with a human confirmation step before
anything sends.

This was built to satisfy the assigned track (Obsidian Vault Knowledge Base +
RAG Email Sender) and then extended into a multi-agent orchestration to more
directly demonstrate the Agentic AI and Knowledge Management skills listed in
the role's preferred stack.

## 1. Overview

- **Ask Your Notes** — semantic search + grounded Q&A over an ingested
  Obsidian vault, with citations back to source notes.
- **Draft & Send Email** — a 5-agent pipeline that plans, retrieves, drafts,
  fact-checks, and (if needed) revises an email before a human reviews and
  sends it.
- **Add Note** — the vault isn't static; notes can be added live through the
  app (typed or uploaded as .md/.txt), immediately searchable.

## 2. Architecture

**Stack:** Supabase (Postgres + pgvector) for storage and retrieval, Voyage
AI for embeddings, Groq (with a Gemini fallback) for generation, Resend for
email delivery, Lovable for the UI. All backend logic runs as Supabase Edge
Functions — no separate server to host or manage.

**The five agents, each with a distinct role:**

1. **Planner** — decomposes a request into focused sub-questions, using
   recent conversation history (if any) to resolve references like "the
   third one you mentioned."
2. **Retrieval** — embeds each sub-question, retrieves matching chunks via
   pgvector similarity search, then expands context by following Obsidian
   `[[wikilinks]]` from the top matches — pulling in directly connected
   notes even if they didn't score high on similarity alone.
3. **Draft** — writes the email, grounded only in what Retrieval gathered.
4. **Critic** — independently fact-checks the draft against the sources and
   flags anything unsupported.
5. **Reviser** — if the Critic flags issues, fixes exactly those issues
   (not a full re-draft) and loops back to the Critic, up to 2 times.

**Provider fallback chain:** every LLM call tries Groq's strongest free
model first, a second Groq model if that fails, and Gemini only if both
Groq attempts fail — so a single provider's rate limit or outage doesn't
take the whole pipeline down.

## 3. Obsidian-specific features

- **Wikilinks** (`[[Note Name]]`, `[[Note|Display]]`, `[[Note#Heading]]`) are
  parsed at ingestion and drive real retrieval behavior — the Retrieval
  Agent follows them to pull in connected notes beyond pure similarity
  search. Verified: a question with no semantic connection to a linked note
  still surfaced that note's content, purely via the link.
- **Tags** (`#tag`, including nested tags like `#project/active`) are parsed
  and stored per note.
- **Folder structure** is fully supported — ingestion recursively walks the
  vault directory at any depth. Note titles are derived from filename, not
  folder path, so links resolve correctly regardless of where a note lives.

## 4. Extra features

- **Multi-turn memory** — a `sessionId` persists conversation history (in
  the `agent_runs` table), so follow-up questions can reference earlier
  answers. The Planner reads the last 3 turns of a session as context.
- **Recipient parsing** — email addresses are extracted from natural
  language via regex (deterministic, no LLM call needed).
- **Escalation flag** — if the Reviser can't get a draft fully grounded
  within 2 attempts, the response is flagged `needsHumanReview` instead of
  silently returning a possibly-wrong draft.
- **Audit log** — every run (question, sub-questions, draft, verification,
  revision count, sources) is saved to `agent_runs`, giving a queryable
  history of every agent decision.

## 5. Setup instructions

**Environment variables** (set as Supabase secrets):
```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   # auto-injected by Supabase
VOYAGE_API_KEY
GROQ_API_KEY
GEMINI_API_KEY
RESEND_API_KEY
```

**Database setup** — run the SQL in `supabase/schema.sql` (notes, chunks,
agent_runs tables, pgvector extension, the `match_chunks` similarity
function).

**Deploy the Edge Functions:**
```
supabase functions deploy rag-query
supabase functions deploy email-agent
supabase functions deploy send-email
supabase functions deploy add-note
```

**Ingest the sample vault** (one-time, or whenever notes change offline):
```
npm install @supabase/supabase-js gray-matter
node ingest.mjs
```

**Frontend:** `cd frontend && npm install && npm run dev` (or deploy via
Lovable directly).

## 6. Known limitations

**Grounding vs. relevance.** The Critic Agent verifies that every claim in
a draft is factually supported by the retrieved sources — it does not
verify that the draft actually answers the question asked. In testing, a
follow-up referencing "the third agent mentioned" pulled in a linked note
(via wikilink expansion) that was topically adjacent but incorrect, and
produced a fully-grounded draft about the wrong subject. A relevance check
— comparing the resolved question against the draft's actual content, not
just its factual accuracy — would be the natural next addition.

**Title collisions across folders.** Note titles are derived from filename,
independent of folder, so links resolve consistently regardless of where a
note lives. The trade-off: two notes with the same filename in different
folders would collide, and wikilink resolution (which matches by title)
can't currently disambiguate between them.

**Future work — per-user accounts.** The current system uses session-based
memory (ephemeral per conversation) rather than persistent per-user
history. Adding Google OAuth via Supabase Auth, with `user_id`-scoped RLS
on `notes` and `agent_runs`, would be the natural next step for a
multi-user deployment.

## 7. Evidence / demo highlights

- **Self-correction caught a real fabrication.** A leading question asked
  the system to "confirm AURA has 5,000 active users." The Draft Agent
  initially included the fabricated figure; the Critic flagged it as
  unsupported; the Reviser removed it entirely rather than softening it.
  Final response: `revisionCount: 1`, `grounded: true`, no user-count claim
  anywhere in the final draft.
- **Link expansion proven, not assumed.** A question scoped only to AURA's
  mental-health features still surfaced two chunks from a linked
  (TechCarvaan) note — both with `similarity: null`, meaning they entered
  the context purely through wikilink-following, not semantic search.
- **Full pipeline trace, in one run:** `test-pipeline.mjs` chains
  `email-agent` → `send-email` and prints every stage, doubling as a live
  demo script.
