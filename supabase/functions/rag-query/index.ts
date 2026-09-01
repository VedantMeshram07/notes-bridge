// supabase/functions/rag-query/index.ts
//
// Takes a question, embeds it, retrieves the closest note chunks via
// match_chunks(), and asks an LLM to answer grounded in those chunks only.
//
// Uses the same provider fallback chain as email-agent: Groq's strongest
// free model first, a second Groq model if that fails, Gemini only if
// both Groq attempts fail. Unlike email-agent this doesn't need structured
// JSON output -- just a grounded text answer -- so this is plain text,
// not JSON mode.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VOYAGE_API_KEY = Deno.env.get("VOYAGE_API_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

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

async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: [text], model: "voyage-3.5", input_type: "query" }),
  });
  if (!res.ok) throw new Error(`Voyage error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function callGroqText(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq (${model}) error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq (${model}) returned no content`);
  return text;
}

async function callGeminiText(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini (${model}) error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini (${model}) returned no text`);
  return text;
}

async function askGrounded(question: string, chunks: { content: string }[]): Promise<string> {
  const contextText = chunks.map((c, i) => `[Source ${i + 1}]\n${c.content}`).join("\n\n");
  const systemPrompt =
    "You are answering questions using only the provided notes. Ground every claim in the " +
    "sources given. If the sources don't contain the answer, say so clearly rather than " +
    "guessing. Cite sources by number, e.g. [Source 1]. Write in plain text only -- no " +
    "markdown syntax (no **, no #, no pipe tables, no markdown lists). Use plain paragraphs " +
    "and simple dashes for lists if needed, since this text is displayed as-is without " +
    "markdown rendering.";
  const userPrompt = `Context from notes:\n\n${contextText}\n\nQuestion: ${question}`;

  let lastError: Error | null = null;
  for (const attempt of LLM_CHAIN) {
    try {
      if (attempt.provider === "groq") return await callGroqText(attempt.model, systemPrompt, userPrompt);
      return await callGeminiText(attempt.model, systemPrompt, userPrompt);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`LLM attempt failed (${attempt.provider}/${attempt.model}): ${lastError.message}`);
    }
  }
  throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "Request body must include a 'question' string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const queryEmbedding = await embedQuery(question);

    const { data: matches, error } = await supabase.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      match_count: 5,
    });
    if (error) throw new Error(`Retrieval error: ${error.message}`);

    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({ answer: "I couldn't find anything relevant in your notes.", sources: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const answer = await askGrounded(question, matches);

    return new Response(
      JSON.stringify({
        answer,
        sources: matches.map((m: { note_id: string; similarity: number; content: string }) => ({
          note_id: m.note_id,
          similarity: m.similarity,
          excerpt: m.content.slice(0, 150),
        })),
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
