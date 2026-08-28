// ingest.mjs
// One-time script: reads markdown notes from ./vault, chunks them,
// generates embeddings via Voyage AI (batched across ALL notes at once),
// and inserts into Supabase.
//
// Setup:
//   npm install @supabase/supabase-js gray-matter
//
// Env vars required (export/set these in your shell before running):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (or your project's "secret" key — service_role/secret, never anon/publishable)
//   VOYAGE_API_KEY
//
// Run:
//   node ingest.mjs

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VAULT_DIR = './vault';

// Voyage's per-request cap is 128 texts. Without a payment method on file,
// the account is also limited to 3 requests/minute — so if we ever need
// more than one batch, we pace requests with this gap.
const EMBED_BATCH_SIZE = 128;
const FREE_TIER_GAP_MS = 21000;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !VOYAGE_API_KEY) {
  console.error('Missing one of SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function chunkText(text, chunkSize = 300, overlap = 50) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
    if (i + chunkSize >= words.length) break;
    i += chunkSize - overlap;
  }
  return chunks.length ? chunks : [text];
}

async function embedBatch(texts) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: texts,
      model: 'voyage-3.5', // 1024-dim default — matches the chunks table
      input_type: 'document',
    }),
  });
  if (!res.ok) {
    throw new Error(`Voyage API error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ingestVault() {
  const files = fs.readdirSync(VAULT_DIR).filter((f) => f.endsWith('.md'));
  console.log(`Found ${files.length} notes in ${VAULT_DIR}`);

  // --- Step 1: parse + chunk every note locally (no network calls yet) ---
  const parsedNotes = files.map((file) => {
    const raw = fs.readFileSync(path.join(VAULT_DIR, file), 'utf-8');
    const { data: frontmatter, content } = matter(raw);
    const title = frontmatter.title || file.replace(/\.md$/, '');
    return { file, title, content, chunks: chunkText(content) };
  });

  // --- Step 2: upsert notes (cheap Supabase calls, not rate-limited) ---
  const noteIdByFile = {};
  for (const note of parsedNotes) {
    const { data, error } = await supabase
      .from('notes')
      .upsert({ title: note.title, path: note.file, content: note.content }, { onConflict: 'path' })
      .select()
      .single();

    if (error) {
      console.error(`Failed to upsert note ${note.file}:`, error.message);
      continue;
    }
    noteIdByFile[note.file] = data.id;
    await supabase.from('chunks').delete().eq('note_id', data.id); // clean slate for re-runs
  }

  // --- Step 3: flatten every chunk across every note into one list ---
  const chunkRefs = [];
  for (const note of parsedNotes) {
    if (!noteIdByFile[note.file]) continue; // skip notes that failed to upsert
    for (const chunkContent of note.chunks) {
      chunkRefs.push({ file: note.file, noteId: noteIdByFile[note.file], content: chunkContent });
    }
  }
  console.log(`Embedding ${chunkRefs.length} chunks total across ${Object.keys(noteIdByFile).length} notes`);

  // --- Step 4: embed in batches of up to 128, pacing requests if there's more than one ---
  const allEmbeddings = [];
  for (let i = 0; i < chunkRefs.length; i += EMBED_BATCH_SIZE) {
    const batch = chunkRefs.slice(i, i + EMBED_BATCH_SIZE).map((r) => r.content);
    console.log(`Embedding batch ${i / EMBED_BATCH_SIZE + 1} (${batch.length} chunks)...`);
    try {
      const embeddings = await embedBatch(batch);
      allEmbeddings.push(...embeddings);
    } catch (err) {
      console.error(`Batch starting at chunk ${i} failed:`, err.message);
      // fill with nulls so indexes stay aligned; these rows get skipped below
      allEmbeddings.push(...new Array(batch.length).fill(null));
    }
    if (i + EMBED_BATCH_SIZE < chunkRefs.length) {
      console.log(`Waiting ${FREE_TIER_GAP_MS / 1000}s before next batch (free-tier rate limit)...`);
      await sleep(FREE_TIER_GAP_MS);
    }
  }

  // --- Step 5: insert all successfully-embedded chunks in one go ---
  const rows = chunkRefs
    .map((ref, i) => ({ note_id: ref.noteId, content: ref.content, embedding: allEmbeddings[i] }))
    .filter((row) => row.embedding !== null);

  if (rows.length > 0) {
    const { error } = await supabase.from('chunks').insert(rows);
    if (error) {
      console.error('Failed to insert chunks:', error.message);
    } else {
      console.log(`✓ Inserted ${rows.length} chunks`);
    }
  }

  const failedCount = chunkRefs.length - rows.length;
  if (failedCount > 0) {
    console.log(`⚠ ${failedCount} chunk(s) failed to embed and were skipped — re-run the script to retry.`);
  }

  console.log('Done.');
}

ingestVault();
