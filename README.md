# MedTech Sourcing Engine (MVP)

A lightweight Next.js + TypeScript MVP that ingests recent medtech literature from OpenAlex, normalizes/scoring opportunities in SQLite, and exposes a simple dashboard + APIs.

## Stack

- Next.js (Pages Router)
- TypeScript
- Tailwind CSS
- SQLite via `better-sqlite3`

## Project structure

- `lib/openalex.ts` - OpenAlex fetch + normalization
- `lib/patents.ts` - patent stub provider (mock opportunities)
- `lib/classify.ts` - keyword-based category classifier
- `lib/score.ts` - explainable 0–100 scoring
- `lib/db.ts` - SQLite init/upsert/query helpers
- `db/init.ts` - one-shot DB initialization script
- `pages/api/ingest.ts` - POST ingestion endpoint
- `pages/api/opportunities.ts` - GET filterable opportunities endpoint
- `pages/index.tsx` - dashboard UI

## Data model

`opportunities` table:

```sql
CREATE TABLE opportunities (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  abstract TEXT,
  authors TEXT,
  institutions TEXT,
  date TEXT,
  doi TEXT,
  url TEXT,
  category TEXT,
  keywords TEXT,
  score_total REAL,
  score_novelty REAL,
  score_momentum REAL,
  score_commercial REAL,
  score_institution REAL,
  location TEXT,
  raw_json TEXT,
  ingested_at TEXT DEFAULT (datetime('now'))
);
```

Indexes:
- `category`
- `score_total DESC`
- `date DESC`

## Setup

```bash
npm install
```

If your environment blocks package downloads, ensure these packages are available:

- `better-sqlite3`

## Initialize DB

```bash
npm run db:init
```

This creates `db/data/medtech.sqlite` and the required schema/indexes.

## Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Trigger ingestion

From another terminal:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"fromDate":"2026-02-01"}'
```

## Query opportunities API

Example:

```bash
curl 'http://localhost:3000/api/opportunities?category=imaging&minScore=20&limit=10'
```

Supported query params:
- `category`
- `location`
- `institution`
- `minScore`
- `fromDate`
- `q`
- `limit`
- `offset`

## Future improvements

- Replace patent stub with real USPTO/other source integration.
- Add periodic ingestion scheduling.
- Improve NLP-based classification.
- Add richer ranking features and explainability UI.
- Add proper analytics and export workflows.
