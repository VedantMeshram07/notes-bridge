// supabase/functions/email-agent/index.ts
//
// Five-agent pipeline (Planner -> Retrieval -> Draft -> Critic -> Reviser),
// plus multi-turn memory, recipient parsing, an escalation flag, and an
// audit log (see previous version's comments for what each of those does).
//
// NEW: every LLM call goes through a provider fallback chain instead of
// calling Gemini directly -- Groq's strongest free model first, a second
// Groq model if that fails, Gemini only if both Groq attempts fail. This
// means a single provider's rate limit or outage doesn't take the whole
// pipeline down.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VOYAGE_API_KEY = Deno.env.get("VOYAGE_API_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

const MAX_REVISIONS = 2;
const MAX_LINK_EXPANSION_CHUNKS = 6;
const HISTORY_LOOKBACK = 3;

// Fallback chain, tried in order. Groq's free tier is far more generous
// (14,400 req/day vs Gemini's 20/day on gemini-3.6-flash), so it goes first.
const LLM_CHAIN: { provider: "groq" | "gemini"; model: string }[] = [
  { provider: "groq", model: "openai/gpt-oss-120b" },
  { provider: "groq", model: "openai/gpt-oss-20b" },
  { provider: "gemini", model: "gemini-3.6-flash" },
];

// CORS: without these headers, a browser (e.g. your Lovable app) blocks
// the request entirely before it even reaches this code.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Chunk = { id: string; note_id: string; content: string; similarity?: number };

async function embedQueries(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: texts, model: "voyage-3.5", input_type: "query" }),
  });
  if (!res.ok) throw new Error(`Voyage error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

async function callGroq(model: string, systemPrompt: string, userPrompt: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Groq (${model}) error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq (${model}) returned no content`);
  return JSON.parse(text);
}

async function callGeminiModel(model: string, systemPrompt: string, userPrompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini (${model}) error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini (${model}) returned no text`);
  return JSON.parse(text);
}

// Walks LLM_CHAIN in order, falling through to the next entry on any
// failure (rate limit, outage, malformed JSON). jsonShapeHint gets baked
// into the prompt since Groq's json_object mode -- unlike Gemini's
// responseSchema -- doesn't take a schema parameter, so both providers
// need the shape spelled out in text either way.
async function callLLM(systemPrompt: string, userPrompt: string, jsonShapeHint: string) {
  const fullSystemPrompt =
    `${systemPrompt}\n\nRespond with ONLY valid JSON, no markdown formatting, ` +
    `matching exactly this shape: ${jsonShapeHint}`;
  let lastError: Error | null = null;

  for (const attempt of LLM_CHAIN) {
    try {
      if (attempt.provider === "groq") {
        return await callGroq(attempt.model, fullSystemPrompt, userPrompt);
      }
      return await callGeminiModel(attempt.model, fullSystemPrompt, userPrompt);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`LLM attempt failed (${attempt.provider}/${attempt.model}): ${lastError.message}`);
    }
  }
  throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
}

function extractRecipientEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

async function fetchSessionHistory(sessionId: string) {
  const { data } = await supabase
    .from("agent_runs")
    .select("question, draft_subject, draft_body, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LOOKBACK);
  return (data ?? []).reverse();
}

// --- Agent 1: Planner ---
async function planQuestions(
  question: string,
  history: { question: string; draft_subject: string; draft_body: string }[],
): Promise<string[]> {
  const historyText = history.length
    ? history
        .map((h, i) => `Turn ${i + 1} - Q: ${h.question}\nA (subject): ${h.draft_subject}\nA (body): ${h.draft_body.slice(0, 300)}`)
        .join("\n\n")
    : "(no prior conversation)";

  const systemPrompt =
    "You break user requests into focused sub-questions for a retrieval system. " +
    "You may be given prior conversation turns -- use them to resolve references like " +
    "'that', 'the second point', or 'also mention X' into a self-contained question. " +
    "If the request is already a single focused question, return it unchanged as the only " +
    "item. If it bundles multiple distinct asks, split them into separate sub-questions.";
  const userPrompt = `Prior conversation:\n${historyText}\n\nCurrent request: ${question}`;
  const result = await callLLM(systemPrompt, userPrompt, '{"subQuestions": string[]}');
  return result.subQuestions?.length ? result.subQuestions : [question];
}

// --- Agent 2: Retrieval (semantic search + wikilink expansion) ---
async function retrieveContext(subQuestions: string[]): Promise<Chunk[]> {
  const embeddings = await embedQueries(subQuestions);
  const seen = new Map<string, Chunk>();
  for (const embedding of embeddings) {
    const { data: matches, error } = await supabase.rpc("match_chunks", {
      query_embedding: embedding,
      match_count: 5,
    });
    if (error) throw new Error(`Retrieval error: ${error.message}`);
    for (const m of matches ?? []) seen.set(m.id, m);
  }

  const matchedNoteIds = [...new Set([...seen.values()].map((c) => c.note_id))];
  if (matchedNoteIds.length > 0) {
    const { data: matchedNotes } = await supabase
      .from("notes")
      .select("id, links")
      .in("id", matchedNoteIds);

    const linkedTitles = [...new Set((matchedNotes ?? []).flatMap((n) => n.links ?? []))];

    if (linkedTitles.length > 0) {
      const { data: linkedNotes } = await supabase.from("notes").select("id").in("title", linkedTitles);
      const linkedNoteIds = (linkedNotes ?? []).map((n) => n.id).filter((id) => !matchedNoteIds.includes(id));

      if (linkedNoteIds.length > 0) {
        const { data: linkedChunks } = await supabase
          .from("chunks")
          .select("id, note_id, content")
          .in("note_id", linkedNoteIds)
          .limit(MAX_LINK_EXPANSION_CHUNKS);
        for (const c of linkedChunks ?? []) if (!seen.has(c.id)) seen.set(c.id, c);
      }
    }
  }

  return [...seen.values()];
}

// --- Agent 3: Draft ---
async function draftEmail(question: string, chunks: Chunk[]) {
  const contextText = chunks.map((c, i) => `[Source ${i + 1}]\n${c.content}`).join("\n\n");
  const systemPrompt =
    "You are an email-drafting agent. Using ONLY the provided source notes, draft a concise, " +
    "professional email that fulfills the user's request. Every factual claim must be " +
    "traceable to the sources. Do not invent details that aren't present in the sources. " +
    "Write in plain text only -- no markdown syntax (no **, no #, no pipe tables). This is " +
    "sent as a plain-text email, so markdown characters would show up literally, not rendered. " +
    "Use plain paragraphs and simple dashes for lists if needed.";
  return callLLM(
    systemPrompt,
    `Sources:\n\n${contextText}\n\nRequest: ${question}`,
    '{"subject": string, "body": string}',
  );
}

// --- Agent 4: Critic ---
async function critiqueDraft(draft: { subject: string; body: string }, chunks: Chunk[]) {
  const contextText = chunks.map((c, i) => `[Source ${i + 1}]\n${c.content}`).join("\n\n");
  const systemPrompt =
    "You are a fact-checking agent. Check every factual claim in the draft against the " +
    "sources. Flag anything not directly supported. Be strict: if a claim is a reasonable " +
    "inference but not explicitly stated in the sources, flag it.";
  const userPrompt = `Sources:\n\n${contextText}\n\nDraft subject: ${draft.subject}\nDraft body:\n${draft.body}`;
  return callLLM(
    systemPrompt,
    userPrompt,
    '{"grounded": boolean, "issues": string[], "summary": string}',
  );
}

// --- Agent 5: Reviser ---
async function reviseDraft(draft: { subject: string; body: string }, chunks: Chunk[], issues: string[]) {
  const contextText = chunks.map((c, i) => `[Source ${i + 1}]\n${c.content}`).join("\n\n");
  const systemPrompt =
    "You are a revision agent. You will be given a draft email, its sources, and specific " +
    "issues a fact-checker flagged. Fix exactly those issues using the sources. Keep " +
    "everything else the draft got right unchanged. Do not introduce new claims not in the sources. " +
    "Write in plain text only -- no markdown syntax (no **, no #, no pipe tables), since this " +
    "is sent as a plain-text email.";
  const userPrompt =
    `Sources:\n\n${contextText}\n\nCurrent draft subject: ${draft.subject}\n` +
    `Current draft body:\n${draft.body}\n\nFlagged issues:\n${issues.map((i) => `- ${i}`).join("\n")}`;
  return callLLM(systemPrompt, userPrompt, '{"subject": string, "body": string}');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, sessionId: incomingSessionId } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "Request body must include a 'question' string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sessionId = incomingSessionId || crypto.randomUUID();
    const history = incomingSessionId ? await fetchSessionHistory(sessionId) : [];

    const recipientEmail = extractRecipientEmail(question);
    const subQuestions = await planQuestions(question, history);
    const chunks = await retrieveContext(subQuestions);

    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No relevant notes found for this request.", subQuestions, sessionId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let draft = await draftEmail(question, chunks);
    let verification = await critiqueDraft(draft, chunks);
    let revisionCount = 0;

    while ((!verification.grounded || verification.issues.length > 0) && revisionCount < MAX_REVISIONS) {
      draft = await reviseDraft(draft, chunks, verification.issues);
      verification = await critiqueDraft(draft, chunks);
      revisionCount++;
    }

    const needsHumanReview = !verification.grounded || verification.issues.length > 0;

    const sources = chunks.map((c) => ({
      note_id: c.note_id,
      similarity: c.similarity ?? null,
      excerpt: c.content.slice(0, 150),
    }));

    await supabase.from("agent_runs").insert({
      session_id: sessionId,
      question,
      sub_questions: subQuestions,
      recipient_email: recipientEmail,
      draft_subject: draft.subject,
      draft_body: draft.body,
      grounded: verification.grounded,
      issues: verification.issues,
      revision_count: revisionCount,
      needs_human_review: needsHumanReview,
      sources,
    });

    return new Response(
      JSON.stringify({
        sessionId,
        draft,
        verification,
        subQuestions,
        revisionCount,
        needsHumanReview,
        recipientEmail,
        sources,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
