# Notes Bridge AI

Build a single-page React app called "Notes Bridge" — a UI for an existing RAG + AI-agent backend. Do NOT set up Lovable Cloud, a database, or any backend — this app only makes fetch calls to three already-deployed Supabase Edge Functions. All requests need these exact headers:

Content-Type: application/json

Authorization: Bearer sb_publishable_7sn2F_9ASXQRdAvcN8r9rA_va0xWGVW

Base URL for all three: https://ttixfaajiwhtmylmcduc.functions.supabase.co

Build two tabs: "Ask Your Notes" and "Draft & Send Email".

=== TAB 1: Ask Your Notes ===

A text input + submit button. On submit, POST to /rag-query with body:

{ "question": "<user input>" }

Response shape:

{ "answer": "<string>", "sources": [{ "note_id": "<string>", "similarity": <number or null>, "excerpt": "<string>" }] }

Display the answer as formatted text. Below it, show a collapsible "Sources" section listing each source's excerpt and similarity score (show "linked note" instead of a percentage if similarity is null).

=== TAB 2: Draft & Send Email ===

This is a multi-step flow, not a single form:

Step 1 — Text input + submit button ("Generate Draft"). On submit, POST to /email-agent with body:

{ "question": "<user input>", "sessionId": "<stored session id, or omit if this is the first message> " }

Response shape:

{

  "sessionId": "<string>",

  "draft": { "subject": "<string>", "body": "<string>" },

  "verification": { "grounded": <boolean>, "issues": ["<string>"], "summary": "<string>" },

  "subQuestions": ["<string>"],

  "revisionCount": <number>,

  "needsHumanReview": <boolean>,

  "recipientEmail": "<string or null>",

  "sources": [{ "note_id": "<string>", "similarity": <number or null>, "excerpt": "<string>" }]

}

Store the returned sessionId in state and reuse it on every subsequent request in this tab, so follow-up questions build on the conversation. Show a simple running list of past questions asked in this session above the input, so the user can see the conversation building.

Step 2 — After a draft comes back, show:

- The draft subject and body in EDITABLE text fields (user can tweak before sending)

- A recipient email input, pre-filled with recipientEmail if it was returned, otherwise empty and required

- An "Agent Trace" collapsible section showing: subQuestions (as a list), revisionCount, and the verification.summary — label this section "How the AI reached this answer"

- If needsHumanReview is true, show a prominent red/orange warning banner ABOVE the draft: "This draft could not be fully verified against your notes — review carefully before sending" and list the verification.issues

- If needsHumanReview is false and revisionCount is 0, show a small green "Verified on first pass" badge

- If needsHumanReview is false and revisionCount > 0, show a small blue badge: "Verified after N correction(s)"

Step 3 — A "Send Email" button, disabled until the recipient email field is non-empty and looks like a valid email. On click, POST to /send-email with body:

{ "to": "<recipient email from field>", "subject": "<subject from field>", "body": "<body from field>" }

Response shape on success: { "sent": true, "id": "<string>" }

On failure: { "error": "<string>" }

Show a clear success confirmation ("Email sent") or error message after this call. Do not auto-send — sending only happens on explicit button click after the user has seen the draft.

=== Design ===

Clean, minimal, dark-mode friendly. This is a demo/portfolio project — prioritize clarity over decoration. Use clear loading states for all three API calls (spinner or skeleton, not a blank screen) since responses can take a few seconds.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/95e31205-cae4-4c0e-aba2-9e69e92649a5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
