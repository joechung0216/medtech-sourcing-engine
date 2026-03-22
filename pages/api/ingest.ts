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
      openAlex = await fetchOpenAlexWorks({ fromDate });
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
      })),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
