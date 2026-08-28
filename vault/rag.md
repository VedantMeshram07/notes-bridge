# Automated RAG System — Autonomous Document Intelligence

An agentic document Q&A system that transforms static, unstructured PDFs into dynamic, queryable knowledge. The system ingests complex PDF documents (including tables, figures, and narrative text), indexes them into a vector store, and uses autonomous LLM agents to answer multi-step queries with mathematical accuracy } and verifiable citations.

Built as two independent approaches to the same problem — each with different trade-offs between determinism, flexibility, and API cost.

> **Source Material:** [Cyber Ireland 2022 Report](https://cyberireland.ie/wp-content/uploads/2022/05/State-of-the-Cyber-Security-Sector-in-Ireland-2022.pdf) — a 40-page industry report containing narrative text, strategic projections, and complex regional data tables.

---

## Repository Structure

```
automated-rag-system/
├── automated-rag-system (OFFLINE)/          ← Approach 1: Deterministic Orchestrator
│   ├── backend/
│   │   ├── agents/              # Tiered classifier, query planner, LangGraph agent
│   │   ├── etl/                 # PDF ingestion, table parser, chunker
│   │   ├── services/            # Local orchestrator, hybrid retriever, answer builder
│   │   ├── vector_store/        # ChromaDB wrapper
│   │   ├── logs/                # trace.json (agent reasoning logs)
│   │   ├── main.py              # FastAPI  →  port 8000
│   │   ├── run_assignment_queries.py   # Runs all test queries
│   │   └── requirements.txt
│   ├── frontend/                # React + Vite chat UI
│   ├── data/source/             ← place PDF(s) here before ETL
│   ├── .env.example
│   ├── README.md
│   └── SETUP.md
│
├── automated-rag-system (WITH EXTERNAL MODEL)/
│   └── autonomous-doccument-agent/           ← Approach 2: LLM-Driven Agent
│       ├── backend/
│       │   ├── agents/          # LangGraph agent graph, tools, system prompt
│       │   ├── etl/             # Same ETL pipeline as Approach 1
│       │   ├── services/        # Query service
│       │   ├── vector_store/    # ChromaDB wrapper
│       │   ├── logs/            # trace.json (agent reasoning logs)
│       │   ├── main.py          # FastAPI  →  port 8001
│       │   ├── run_assignment_queries.py   # Runs all test queries
│       │   └── requirements.txt
│       ├── frontend/            # React + Vite chat UI
│       ├── data/source/         ← place PDF(s) here before ETL
│       ├── .env.example
│       ├── README.md
│       └── SETUP.md
│
└── ARCHITECTURE.md              ← Detailed technical explanation of both approaches
```

---

## Evaluation Results

Both approaches were evaluated against the assignment's three core test queries, plus two additional stress tests:

| Test | Query | Approach 1 (OFFLINE) | Approach 2 (LLM-Driven) |
|------|-------|---------------------|--------------------------|
| **1 — Verification** | Total number of jobs reported, exact location | **7,351** (Page 19) ✅ | **7,351** (Page 19) ✅ |
| **2 — Data Synthesis** | Pure-Play concentration: South-West vs National | **Cork 28.7% vs National 26.0%** (Page 15) ✅ | **Cork 28.7% vs National 26.0%** ✅ |
| **3 — Forecasting** | CAGR from 2022 baseline to 2030 target | **11.05%** (7,351→17,000, 8 years) ✅ | **11.05%** ✅ |
| 4 — Firms Count | How many cybersecurity firms in Ireland? | **489 firms** (Page 19) ✅ | — |
| 5 — Percentage Exceed | 2030 target exceeds baseline by what %? | **131.3%** increase ✅ | — |

---

## Quick Start

Both approaches share a single virtual environment. From the repository root:

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows PowerShell
pip install -r "automated-rag-system (OFFLINE)/backend/requirements.txt"
```

Then follow the approach-specific setup:
- [Approach 1 Setup Guide](automated-rag-system%20(OFFLINE)/SETUP.md)
- [Approach 2 Setup Guide](automated-rag-system%20(WITH%20EXTERNAL%20MODEL)/autonomous-doccument-agent/SETUP.md)

For a detailed technical deep-dive into how each approach works, see **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## Side-by-Side Comparison

| Dimension | Approach 1 — Deterministic Orchestrator | Approach 2 — LLM-Driven Agent |
|---|---|---|
| **Orchestration** | Python-deterministic (LocalOrchestrator) | Gemini drives all tool calls in a react loop |
| **Query classification** | 3-tier: regex → sentence-transformers → Gemini | None — Gemini infers intent from system prompt |
| **Gemini calls per query** | 0 for structured types; 1 for open-ended | 2–4 (tool routing + forced conclusion) |
| **Retrieval** | Hybrid (vector + BM25 keyword + table-aware + re-ranking) | Pure vector search via document_retriever |
| **Math** | Deterministic Python (always computed locally) | `math_tool` called by Gemini when it decides to |
| **Answer generation** | Typed Python templates with citations | LLM synthesis — answer extracted from final AIMessage |
| **Table handling** | Structured JSON parsing with column identification | LLM interprets table content from retrieved chunks |
| **Reliability for numerics** | High — deterministic computation pipelines | Medium — depends on Gemini using math_tool correctly |
| **Flexibility** | Handles well-defined query patterns reliably | Adapts to novel, ambiguous, and conversational queries |
| **New document portability** | Generic anchors + ETL re-run | Update prompt hints in `prompts.py` + ETL re-run |
| **Backend port** | 8000 | 8001 |

---

## Shared Components

Both approaches share:
- **ETL pipeline** — `ingest_pdf.py`, `table_parser.py`, `chunking.py` (PyMuPDF + pdfplumber dual extraction)
- **ChromaDB** vector store with `all-MiniLM-L6-v2` local embeddings
- **React + Vite** frontend with chat interface and trace viewer
- **FastAPI** backend with `/query` endpoint
- **Same `.env` configuration** keys

---

## Core Deliverables

| Assignment Requirement | Where to Find |
|---|---|
| **ETL Pipeline** | `backend/etl/` in both approaches — `ingest_pdf.py`, `table_parser.py`, `chunking.py` |
| **Agentic Backend** | `backend/main.py` → `/query` endpoint in both approaches |
| **Execution Logs/Traces** | `backend/logs/trace.json` — step-by-step agent reasoning per query |
| **README.md** | This file + per-approach READMEs |
| **Architecture Justification** | [ARCHITECTURE.md](ARCHITECTURE.md) — full technical deep-dive |
| **Limitations** | Per-approach README.md → Limitations section |

---

## Running Both Systems Simultaneously

Because the backends run on different ports (8000 and 8001), both can be active at the same time:

**Terminal 1 — Approach 1:**

```bash
cd "automated-rag-system (OFFLINE)/backend"
```

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Approach 2:**

```bash
cd "automated-rag-system (WITH EXTERNAL MODEL)/autonomous-doccument-agent/backend"
```

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

---

## Execution Traces

Both systems log reasoning traces to `backend/logs/trace.json` inside their respective project directories. After running queries, these files contain a JSON array where each entry has:

- `timestamp`, `query`, `answer`, `sources`
- `reasoning_trace` — the full step-by-step thought process array
- `query_type` (Approach 1 only) — the classified query type with confidence score
- `trace_summary` (Approach 1 only) — classifier tier and sub-type metadata

These files are the "execution proof" for any query submitted to either system.
