// supabase/functions/add-note/index.ts
//
// Lets the live app add a new note to the vault, instead of that only
// being possible via the local ingest.mjs script. Takes a title + content,
// extracts wikilinks and tags the same way ingestion does, chunks it,
// embeds it, and stores it -- so a note added here is immediately
// searchable by rag-query and email-agent.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VOYAGE_API_KEY = Deno.env.get("VOYAGE_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Same extraction logic as ingest.mjs, kept in sync so a note added here
// behaves identically to one added via the local script.
function extractWikilinks(text: string): string[] {
  const matches = [...text.matchAll(/\[\[([^\]|#]+)/g)];
  return [...new Set(matches.map((m) => m[1].trim()))];
}

function extractTags(text: string): string[] {
  const matches = [...text.matchAll(/#([a-zA-Z0-9_/-]+)/g)];
  return [...new Set(matches.map((m) => m[1].trim()))];
}

function chunkText(text: string, chunkSize = 300, overlap = 50): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
    if (i + chunkSize >= words.length) break;
    i += chunkSize - overlap;
  }
  return chunks.length ? chunks : [text];
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: texts, model: "voyage-3.5", input_type: "document" }),
  });
  if (!res.ok) throw new Error(`Voyage error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, content, folder } = await req.json();
    if (!title || !content || typeof title !== "string" || typeof content !== "string") {
      return new Response(
        JSON.stringify({ error: "Request body must include 'title' and 'content' strings" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sanitize title into a filesystem-safe slug for the path column
    const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const notePath = folder ? `${folder}/${slug}.md` : `${slug}.md`;

    const links = extractWikilinks(content);
    const tags = extractTags(content);
    const chunks = chunkText(content);

    const { data: note, error: noteError } = await supabase
      .from("notes")
      .upsert({ title, path: notePath, content, links, tags }, { onConflict: "path" })
      .select()
      .single();

    if (noteError) throw new Error(`Failed to save note: ${noteError.message}`);

    // Clean slate for re-adds (editing an existing note through this same endpoint)
    await supabase.from("chunks").delete().eq("note_id", note.id);

    const embeddings = await embedBatch(chunks);
    const rows = chunks.map((c, i) => ({ note_id: note.id, content: c, embedding: embeddings[i] }));

    const { error: chunkError } = await supabase.from("chunks").insert(rows);
    if (chunkError) throw new Error(`Failed to save chunks: ${chunkError.message}`);

    return new Response(
      JSON.stringify({
        saved: true,
        note: { id: note.id, title: note.title, path: note.path, links, tags },
        chunksCreated: rows.length,
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
