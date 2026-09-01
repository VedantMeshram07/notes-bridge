-- Notes Bridge — full database schema
-- Run this in Supabase's SQL Editor on a fresh project.

-- 1. Enable pgvector
create extension if not exists vector;

-- 2. Notes table — one row per Obsidian note
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  path text unique not null,
  content text not null,
  links text[] default '{}',   -- [[wikilinks]] found in this note
  tags text[] default '{}',    -- #tags found in this note
  created_at timestamptz not null default now()
);

-- 3. Chunks table — embedded pieces of each note
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  content text not null,
  embedding vector(1024), -- matches Voyage's voyage-3.5 default output dimension
  created_at timestamptz not null default now()
);

-- 4. Index for fast similarity search
create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops);

-- 5. Similarity search function — called via .rpc() from Edge Functions
create or replace function match_chunks (
  query_embedding vector(1024),
  match_count int default 5
)
returns table (
  id uuid,
  note_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    chunks.id,
    chunks.note_id,
    chunks.content,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- 6. Audit log / multi-turn memory — every agent run is saved here,
--    and this same table is what session-based follow-up memory reads from
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  question text not null,
  sub_questions text[],
  recipient_email text,
  draft_subject text,
  draft_body text,
  grounded boolean,
  issues text[],
  revision_count int,
  needs_human_review boolean,
  sources jsonb,
  created_at timestamptz not null default now()
);

-- 7. Lock down direct table access — all reads/writes go through
--    Edge Functions using the service_role key, which bypasses RLS
alter table notes enable row level security;
alter table chunks enable row level security;
alter table agent_runs enable row level security;
-- No policies added on purpose: anon/public gets zero direct access.
