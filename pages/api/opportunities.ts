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

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
}
