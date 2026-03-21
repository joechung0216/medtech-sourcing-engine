export type OpenAlexNormalizedWork = {
  id: string;
  source: "openalex";
  title: string;
  abstract: string | null;
  authors: string;
  institutions: string;
  date: string | null;
  doi: string | null;
  url: string | null;
  cited_by_count: number;
  raw: unknown;
};

const OPENALEX_WORKS_URL = "https://api.openalex.org/works";

export const DEFAULT_INSTITUTION_IDS = [
  "I149506389", // Rice University
  "I71493762", // Baylor College of Medicine
  "I4210100500", // UTHealth Houston
  "I5014037", // MD Anderson
];

function parseAbstract(invertedIndex?: Record<string, number[]>): string | null {
  if (!invertedIndex) return null;

  const positionedWords: Array<{ index: number; word: string }> = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const index of positions) {
      positionedWords.push({ index, word });
    }
  }

  if (!positionedWords.length) return null;

  positionedWords.sort((a, b) => a.index - b.index);
  return positionedWords.map((w) => w.word).join(" ");
}

export async function fetchOpenAlexWorks({
  fromDate,
  institutionIds = DEFAULT_INSTITUTION_IDS,
  perPage = 100,
}: {
  fromDate: string;
  institutionIds?: string[];
  perPage?: number;
}): Promise<OpenAlexNormalizedWork[]> {
  const safePerPage = Math.min(Math.max(perPage, 1), 200);
  const filters = [`from_publication_date:${fromDate}`];

  if (institutionIds.length > 0) {
    filters.push(`institutions.id:${institutionIds.join("|")}`);
  }

  const params = new URLSearchParams({
    filter: filters.join(","),
    per_page: String(safePerPage),
    sort: "publication_date:desc",
  });

  const url = `${OPENALEX_WORKS_URL}?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "medtech-sourcing-engine/0.1 (local-mvp)",
      },
    });
  } catch (error) {
    throw new Error(`Failed to reach OpenAlex: ${(error as Error).message}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAlex API error ${response.status}: ${body.slice(0, 400)}`);
  }

  const json = (await response.json()) as {
    results?: Array<Record<string, unknown>>;
  };

  const works = json.results ?? [];

  return works
    .filter((work) => work?.id && work?.title)
    .map((work) => {
      const authorships = Array.isArray(work.authorships) ? work.authorships : [];
      const authorNames = authorships
        .map((a) => a?.author?.display_name)
        .filter(Boolean)
        .join(", ");

      const institutionNames = authorships
        .flatMap((a) => (Array.isArray(a?.institutions) ? a.institutions : []))
        .map((i) => i?.display_name)
        .filter(Boolean)
        .filter((name, index, arr) => arr.indexOf(name) === index)
        .join(", ");

      return {
        id: String(work.id),
        source: "openalex" as const,
        title: String(work.title),
        abstract: parseAbstract(work.abstract_inverted_index),
        authors: authorNames,
        institutions: institutionNames,
        date: work.publication_date ?? null,
        doi: work.doi ?? null,
        url: work.primary_location?.landing_page_url ?? work.id ?? null,
        cited_by_count: Number(work.cited_by_count ?? 0),
        raw: work,
      };
    });
}
