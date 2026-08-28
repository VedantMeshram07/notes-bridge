// supabase/functions/rag-query/index.ts
//
// Takes a question, embeds it, retrieves the closest note chunks via
// the match_chunks() SQL function, and asks Gemini to answer grounded
// in those chunks only.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by
// Supabase -- you do NOT need to set these as secrets yourself.
// You DO need to set: VOYAGE_API_KEY, GEMINI_API_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VOYAGE_API_KEY = Deno.env.get("VOYAGE_API_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = "gemini-3.6-flash"; // free-tier eligible

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [text],
      model: "voyage-3.5",
      input_type: "query",
    }),
  });
  if (!res.ok) throw new Error(`Voyage error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function askGemini(
  question: string,
  chunks: { content: string; note_id: string }[],
): Promise<string> {
  const contextText = chunks
    .map((c, i) => `[Source ${i + 1}]\n${c.content}`)
    .join("\n\n");

  const systemPrompt =
    "You are answering questions using only the provided notes. " +
    "Ground every claim in the sources given. If the sources don't contain " +
    "the answer, say so clearly rather than guessing. Cite sources by number, e.g. [Source 1].";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            parts: [
              { text: `Context from notes:\n\n${contextText}\n\nQuestion: ${question}` },
            ],
          },
        ],
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini returned no text: ${JSON.stringify(data)}`);
  return text;
}

Deno.serve(async (req: Request) => {
  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "Request body must include a 'question' string" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
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
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const answer = await askGemini(question, matches);

    return new Response(
      JSON.stringify({
        answer,
        sources: matches.map((m: { note_id: string; similarity: number; content: string }) => ({
          note_id: m.note_id,
          similarity: m.similarity,
          excerpt: m.content.slice(0, 150),
        })),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
