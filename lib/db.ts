import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type Opportunity = {
  id: string;
  source: string;
  title: string;
  abstract: string | null;
  authors: string | null;
  institutions: string | null;
  date: string | null;
  doi: string | null;
  url: string | null;
  category: string | null;
  keywords: string | null;
  score_total: number | null;
  score_novelty: number | null;
  score_momentum: number | null;
  score_commercial: number | null;
  score_institution: number | null;
  location: string | null;
  raw_json: string | null;
};

export type OpportunityFilters = {
  category?: string;
  location?: string;
  institution?: string;
  minScore?: number;
  fromDate?: string;
  q?: string;
  sort?: "score_desc" | "newest";
  limit?: number;
  offset?: number;
};

const dataDir = path.join(process.cwd(), "db", "data");
const dbPath = path.join(dataDir, "medtech.sqlite");

let dbInstance: Database.Database | null = null;

function getDb(): Database.Database {
  if (!dbInstance) {
    fs.mkdirSync(dataDir, { recursive: true });
    dbInstance = new Database(dbPath);
    dbInstance.pragma("journal_mode = WAL");
  }
  return dbInstance;
}

export function initDb(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS opportunities (
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

    CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities(category);
    CREATE INDEX IF NOT EXISTS idx_opportunities_score_total ON opportunities(score_total DESC);
    CREATE INDEX IF NOT EXISTS idx_opportunities_date ON opportunities(date DESC);
  `);
}

export function upsertOpportunities(items: Opportunity[]): { insertedOrUpdated: number } {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO opportunities (
      id, source, title, abstract, authors, institutions, date, doi, url,
      category, keywords, score_total, score_novelty, score_momentum,
      score_commercial, score_institution, location, raw_json
    ) VALUES (
      @id, @source, @title, @abstract, @authors, @institutions, @date, @doi, @url,
      @category, @keywords, @score_total, @score_novelty, @score_momentum,
      @score_commercial, @score_institution, @location, @raw_json
    )
    ON CONFLICT(id) DO UPDATE SET
      source=excluded.source,
      title=excluded.title,
      abstract=excluded.abstract,
      authors=excluded.authors,
      institutions=excluded.institutions,
      date=excluded.date,
      doi=excluded.doi,
      url=excluded.url,
      category=excluded.category,
      keywords=excluded.keywords,
      score_total=excluded.score_total,
      score_novelty=excluded.score_novelty,
      score_momentum=excluded.score_momentum,
      score_commercial=excluded.score_commercial,
      score_institution=excluded.score_institution,
      location=excluded.location,
      raw_json=excluded.raw_json,
      ingested_at=datetime('now')
  `);

  const tx = db.transaction((rows: Opportunity[]) => {
    for (const row of rows) {
      stmt.run(row);
    }
  });

  tx(items);
  return { insertedOrUpdated: items.length };
}

export function queryOpportunities(filters: OpportunityFilters) {
  const db = getDb();
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.category) {
    where.push("category = @category");
    params.category = filters.category;
  }
  if (filters.location) {
    where.push("location LIKE @location");
    params.location = `%${filters.location}%`;
  }
  if (filters.institution) {
    where.push("institutions LIKE @institution");
    params.institution = `%${filters.institution}%`;
  }
  if (typeof filters.minScore === "number" && !Number.isNaN(filters.minScore)) {
    where.push("COALESCE(score_total, 0) >= @minScore");
    params.minScore = filters.minScore;
  }
  if (filters.fromDate) {
    where.push("date >= @fromDate");
    params.fromDate = filters.fromDate;
  }
  if (filters.q) {
    where.push("(title LIKE @q OR abstract LIKE @q OR keywords LIKE @q)");
    params.q = `%${filters.q}%`;
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);

  const orderByClause =
    filters.sort === "newest"
      ? "ORDER BY date DESC, COALESCE(score_total, 0) DESC"
      : "ORDER BY COALESCE(score_total, 0) DESC, date DESC";

  const results = db
    .prepare(
      `SELECT * FROM opportunities
       ${whereClause}
       ${orderByClause}
       LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset });

  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM opportunities ${whereClause}`)
    .get(params) as { total: number };

  return { results, total: countRow.total };
}

export function getDbPath() {
  return dbPath;
}
