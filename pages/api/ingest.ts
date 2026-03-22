import type { NextApiRequest, NextApiResponse } from "next";
import { classifyOpportunity } from "../../lib/classify";
import { initDb, upsertOpportunities } from "../../lib/db";
import { buildOpenAlexUrl, fetchOpenAlexWorks } from "../../lib/openalex";
import { fetchPatentOpportunitiesStub } from "../../lib/patents";
import { scoreOpportunity } from "../../lib/score";

function deriveLocation(institutions: string): string {
  const value = institutions.toLowerCase();
  if (value.includes("houston")) return "Houston, TX";
  if (value.includes("texas")) return "Texas, USA";
  if (value.includes("rice") || value.includes("baylor") || value.includes("md anderson")) return "Houston, TX";
  return "Unknown";
}

function keepApprovedOpenAlexRows<T extends { matched_institution_ids: string[] }>(rows: T[]): T[] {
  return rows.filter((row) => row.matched_institution_ids.length > 0);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    initDb();

    const fromDate = typeof req.body?.fromDate === "string" ? req.body.fromDate : new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
    const openAlexUrl = buildOpenAlexUrl({ fromDate });

    let openAlex;
    try {
      const fetchedOpenAlex = await fetchOpenAlexWorks({ fromDate });
      openAlex = keepApprovedOpenAlexRows(fetchedOpenAlex);
    } catch (error) {
      const detailedError = error instanceof Error ? error.message : String(error);
      return res.status(502).json({
        ok: false,
        fromDate,
        openAlexUrl,
        error: detailedError,
      });
    }

    const patents = await fetchPatentOpportunitiesStub();
    const combined = [...openAlex, ...patents];

    const enriched = combined.map((item) => {
      const combinedText = `${item.title} ${item.abstract ?? ""}`;
      const classification = classifyOpportunity(combinedText);
      const score = scoreOpportunity({
        date: item.date,
        cited_by_count: item.cited_by_count,
        title: item.title,
        abstract: item.abstract,
        institutions: item.institutions,
      });

      const matchedIds = Array.isArray((item as { matched_institution_ids?: string[] }).matched_institution_ids)
        ? (item as { matched_institution_ids: string[] }).matched_institution_ids
        : [];
      const matchedNames = Array.isArray((item as { matched_institution_names?: string[] }).matched_institution_names)
        ? (item as { matched_institution_names: string[] }).matched_institution_names
        : [];

      return {
        id: item.id,
        source: item.source,
        title: item.title,
        abstract: item.abstract,
        authors: item.authors || null,
        institutions: item.institutions || null,
        date: item.date,
        doi: item.doi,
        url: item.url,
        category: classification.category,
        keywords: classification.keywords.join(", "),
        score_total: score.total,
        score_novelty: score.novelty,
        score_momentum: score.momentum,
        score_commercial: score.commercial,
        score_institution: score.institution,
        location: deriveLocation(item.institutions),
        matched_institution_ids: matchedIds.join(", ") || null,
        matched_institution_names: matchedNames.join(", ") || null,
        source_reason:
          item.source === "openalex"
            ? `Matched OpenAlex institution filter: ${matchedNames.join(", ")}`
            : "Matched patent stub provider",
        openalex_filter_used: item.source === "openalex" ? (item as { openalex_filter_used?: string }).openalex_filter_used ?? null : null,
        raw_json: JSON.stringify(item.raw),
      };
    });

    const outcome = upsertOpportunities(enriched);

    return res.status(200).json({
      ok: true,
      fromDate,
      openAlexUrl,
      openAlexCount: openAlex.length,
      patentCount: patents.length,
      insertedOrUpdated: outcome.insertedOrUpdated,
      sample: enriched.slice(0, 5).map((item) => ({
        id: item.id,
        source: item.source,
        title: item.title,
        institutions: item.institutions,
        date: item.date,
        category: item.category,
        score_total: item.score_total,
        location: item.location,
        source_reason: item.source_reason,
        matched_institution_ids: item.matched_institution_ids,
        matched_institution_names: item.matched_institution_names,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
