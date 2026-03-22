import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Opportunity = {
  id: string;
  source: string;
  title: string;
  abstract: string | null;
  authors: string | null;
  institutions: string | null;
  date: string | null;
  url: string | null;
  category: string | null;
  keywords: string | null;
  score_total: number | null;
  score_novelty: number | null;
  score_momentum: number | null;
  score_commercial: number | null;
  score_institution: number | null;
  location: string | null;
};

type ApiResponse = {
  results: Opportunity[];
  total: number;
};

type IngestResponse = {
  ok: boolean;
  fromDate: string;
  openAlexUrl: string;
  openAlexCount: number;
  patentCount: number;
  insertedOrUpdated: number;
  sample: Array<{
    id: string;
    source: string;
    title: string;
    institutions: string | null;
    date: string | null;
    category: string | null;
    score_total: number | null;
    location: string | null;
  }>;
  error?: string;
};

const categories = [
  "",
  "diagnostics",
  "neurotech",
  "cardiovascular",
  "surgical robotics",
  "ai-device",
  "implantables",
  "imaging",
  "drug delivery",
  "unclassified",
];

export default function DashboardPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [institution, setInstitution] = useState("");
  const [minScore, setMinScore] = useState("0");
  const [sort, setSort] = useState<"score_desc" | "newest">("score_desc");

  const [loading, setLoading] = useState(false);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse>({ results: [], total: 0 });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (category) p.set("category", category);
    if (location) p.set("location", location);
    if (institution) p.set("institution", institution);
    if (minScore && Number(minScore) > 0) p.set("minScore", minScore);
    p.set("sort", sort);
    p.set("limit", "50");
    return p;
  }, [query, category, location, institution, minScore, sort]);

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setLocation("");
    setInstitution("");
    setMinScore("0");
    setSort("score_desc");
  };

  const loadData = useCallback(async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/opportunities?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Load failed: ${response.status}`);
      }
      const json = (await response.json()) as ApiResponse;
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function runIngest() {
    setIngestLoading(true);
    setError(null);
    setIngestMessage(null);
    try {
      const fromDate = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate }),
      });

      const json = (await response.json()) as IngestResponse;
      if (!response.ok || !json.ok) {
        throw new Error(json.error || `Ingest failed: ${response.status}`);
      }

      setIngestMessage(`Ingested ${json.insertedOrUpdated} opportunities (${json.openAlexCount} OpenAlex + ${json.patentCount} patents).`);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIngestLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    loadData();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">MedTech Sourcing Engine MVP</h1>
          <button
            onClick={runIngest}
            disabled={ingestLoading}
            className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {ingestLoading ? "Ingesting..." : "Refresh / Ingest"}
          </button>
        </div>

        <form onSubmit={onSubmit} className="mb-4 rounded bg-white p-4 shadow">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, abstract, keywords"
              className="rounded border p-2 lg:col-span-2"
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border p-2">
              {categories.map((c) => (
                <option key={c || "all"} value={c}>
                  {c || "All categories"}
                </option>
              ))}
            </select>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              className="rounded border p-2"
            />
            <input
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="Institution"
              className="rounded border p-2"
            />
            <input
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              type="number"
              min={0}
              max={100}
              placeholder="Min score"
              className="rounded border p-2"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600" htmlFor="sort">Sort by</label>
              <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as "score_desc" | "newest")} className="rounded border p-2 text-sm">
                <option value="score_desc">Score (desc)</option>
                <option value="newest">Newest</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={clearFilters} className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Clear filters
              </button>
              <button type="submit" className="rounded bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700">
                Apply filters
              </button>
            </div>
          </div>
        </form>

        {ingestMessage && <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">{ingestMessage}</div>}
        {loading && <div className="mb-3 rounded border border-blue-200 bg-blue-50 p-4 text-blue-800 shadow">Loading opportunities...</div>}
        {error && <div className="mb-3 rounded border border-red-200 bg-red-50 p-4 text-red-700">Error: {error}</div>}
        {!loading && !error && data.results.length === 0 && (
          <div className="mb-3 rounded bg-white p-8 text-center text-slate-500 shadow">No opportunities found. Try running ingestion or relaxing filters.</div>
        )}

        <div className="mb-3 text-sm text-slate-600">Total results: {data.total}</div>

        <div className="space-y-3">
          {data.results.map((op) => {
            const open = expanded[op.id] ?? false;
            const score = Number(op.score_total ?? 0);
            return (
              <article key={op.id} className="rounded bg-white p-4 shadow">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-4xl">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">{op.source}</span>
                      <span className="rounded-full bg-indigo-100 px-2 py-1 font-medium text-indigo-700">{op.category ?? "unclassified"}</span>
                    </div>
                    <h2 className="text-lg font-semibold leading-tight">{op.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      <strong>Institution:</strong> {op.institutions ?? "n/a"}
                    </p>
                    <p className="text-sm text-slate-600">
                      <strong>Location:</strong> {op.location ?? "Unknown"} • <strong>Date:</strong> {op.date ?? "n/a"}
                    </p>
                  </div>
                  <div className="min-w-36 text-right">
                    <div className="text-sm font-semibold">Score {score.toFixed(1)}</div>
                    <div className="mt-1 h-2 w-36 rounded bg-slate-200">
                      <div className="h-2 rounded bg-green-500" style={{ width: `${Math.min(score, 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-700">
                  <strong>Keywords:</strong> {op.keywords ?? "n/a"}
                </div>

                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [op.id]: !open }))}
                  className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
                >
                  {open ? "Hide details" : "Show details"}
                </button>

                {open && (
                  <div className="mt-3 rounded bg-slate-50 p-3 text-sm">
                    <p className="mb-2 whitespace-pre-wrap">{op.abstract || "No abstract available."}</p>
                    <p>
                      Novelty: {op.score_novelty} • Momentum: {op.score_momentum} • Commercial: {op.score_commercial} • Institution: {op.score_institution}
                    </p>
                    {op.url && (
                      <a className="mt-2 inline-block text-indigo-600 hover:underline" href={op.url} target="_blank" rel="noreferrer">
                        Open source link
                      </a>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
