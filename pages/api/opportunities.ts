import type { NextApiRequest, NextApiResponse } from "next";
import { initDb, queryOpportunities } from "../../lib/db";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    initDb();

    const { category, location, institution, minScore, fromDate, q, sort, limit, offset } = req.query;

    const data = queryOpportunities({
      category: typeof category === "string" ? category : undefined,
      location: typeof location === "string" ? location : undefined,
      institution: typeof institution === "string" ? institution : undefined,
      minScore: typeof minScore === "string" ? Number(minScore) : undefined,
      fromDate: typeof fromDate === "string" ? fromDate : undefined,
      q: typeof q === "string" ? q : undefined,
      sort: sort === "newest" ? "newest" : "score_desc",
      limit: typeof limit === "string" ? Number(limit) : undefined,
      offset: typeof offset === "string" ? Number(offset) : undefined,
    });

    const cleanResults = data.results.map((row) => ({
      id: row.id,
      source: row.source,
      title: row.title,
      abstract: row.abstract,
      authors: row.authors,
      institutions: row.institutions,
      date: row.date,
      doi: row.doi,
      url: row.url,
      category: row.category,
      keywords: row.keywords,
      score_total: row.score_total,
      score_novelty: row.score_novelty,
      score_momentum: row.score_momentum,
      score_commercial: row.score_commercial,
      score_institution: row.score_institution,
      location: row.location,
      matched_institution_ids: row.matched_institution_ids,
      matched_institution_names: row.matched_institution_names,
      source_reason: row.source_reason,
      openalex_filter_used: row.openalex_filter_used,
    }));

    return res.status(200).json({ results: cleanResults, total: data.total });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
}
