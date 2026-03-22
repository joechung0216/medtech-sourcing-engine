import https from "node:https";

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
  "I149506389",
  "I71493762",
  "I4210100500",
  "I5014037",
];

type RawAuthorship = {
  author?: { display_name?: string };
  institutions?: Array<{ display_name?: string }>;
};

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

function normalizeWorks(works: Array<Record<string, unknown>>): OpenAlexNormalizedWork[] {
  return works
    .filter((work) => work?.id && work?.title)
    .map((work) => {
      const raw = work as Record<string, unknown>;
      const authorships = Array.isArray(raw.authorships) ? (raw.authorships as RawAuthorship[]) : [];

      const authorNames = authorships
        .map((a) => a.author?.display_name)
        .filter((value): value is string => Boolean(value))
        .join(", ");

      const institutionNames = authorships
        .flatMap((a) => (Array.isArray(a.institutions) ? a.institutions : []))
        .map((i) => i.display_name)
        .filter((value): value is string => Boolean(value))
        .filter((name, index, arr) => arr.indexOf(name) === index)
        .join(", ");

      const primaryLocation = (raw.primary_location ?? null) as { landing_page_url?: string } | null;

      return {
        id: String(raw.id),
        source: "openalex" as const,
        title: String(raw.title),
        abstract: parseAbstract((raw.abstract_inverted_index ?? undefined) as Record<string, number[]> | undefined),
        authors: authorNames,
        institutions: institutionNames,
        date: typeof raw.publication_date === "string" ? raw.publication_date : null,
        doi: typeof raw.doi === "string" ? raw.doi : null,
        url: typeof primaryLocation?.landing_page_url === "string" ? primaryLocation.landing_page_url : String(raw.id),
        cited_by_count: Number(raw.cited_by_count ?? 0),
        raw,
      };
    });
}

function extractErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    const maybeCause = (error as Error & { cause?: unknown }).cause;
    if (maybeCause instanceof Error) {
      return `${error.message}; cause=${maybeCause.message}`;
    }
    return error.message;
  }
  return String(error);
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchViaGlobal(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "medtech-sourcing-engine/0.1",
        Accept: "application/json",
      },
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`OpenAlex HTTP ${response.status}. body=${body.slice(0, 500)}`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function fetchViaHttps(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        // DEV ONLY: bypass TLS verification due to local certificate issue
        rejectUnauthorized: false,
        headers: {
          "User-Agent": "medtech-sourcing-engine/0.1",
          Accept: "application/json",
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          const statusCode = res.statusCode ?? 0;
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`OpenAlex HTTPS HTTP ${statusCode}. body=${data.slice(0, 500)}`));
            return;
          }
          resolve(data);
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`HTTPS timeout after ${timeoutMs}ms`)));
    req.end();
  });
}

export function buildOpenAlexUrl({
  fromDate,
  institutionIds = DEFAULT_INSTITUTION_IDS,
  perPage = 100,
}: {
  fromDate: string;
  institutionIds?: string[];
  perPage?: number;
}) {
  const safePerPage = Math.min(Math.max(perPage, 1), 200);
  const filters = [`from_publication_date:${fromDate}`];
  if (institutionIds.length > 0) {
    filters.push(`institutions.id:${institutionIds.join("|")}`);
  }

  const params = new URLSearchParams({
    filter: filters.join(","),
    per_page: String(safePerPage),
  });

  return `${OPENALEX_WORKS_URL}?${params.toString()}`;
}

export async function fetchOpenAlexWorks({
  fromDate,
  institutionIds = DEFAULT_INSTITUTION_IDS,
  perPage = 100,
  timeoutMs = 15000,
}: {
  fromDate: string;
  institutionIds?: string[];
  perPage?: number;
  timeoutMs?: number;
}): Promise<OpenAlexNormalizedWork[]> {
  const url = buildOpenAlexUrl({ fromDate, institutionIds, perPage });
  console.info(`[OpenAlex] Request URL: ${url}`);

  const attemptErrors: string[] = [];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.info(`[OpenAlex] Attempt ${attempt}/3 via fetch`);
      const body = await fetchViaGlobal(url, timeoutMs);
      const json = JSON.parse(body) as { results?: Array<Record<string, unknown>> };
      return normalizeWorks(json.results ?? []);
    } catch (fetchErr) {
      const fetchDetails = extractErrorDetails(fetchErr);
      attemptErrors.push(`attempt ${attempt} fetch failed: ${fetchDetails}`);
      console.warn(`[OpenAlex] Attempt ${attempt} via fetch failed: ${fetchDetails}`);

      try {
        console.info(`[OpenAlex] Attempt ${attempt}/3 via node:https fallback`);
        const body = await fetchViaHttps(url, timeoutMs);
        const json = JSON.parse(body) as { results?: Array<Record<string, unknown>> };
        return normalizeWorks(json.results ?? []);
      } catch (httpsErr) {
        const httpsDetails = extractErrorDetails(httpsErr);
        attemptErrors.push(`attempt ${attempt} https failed: ${httpsDetails}`);
        console.warn(`[OpenAlex] Attempt ${attempt} via https failed: ${httpsDetails}`);
      }
    }

    if (attempt < 3) {
      await delay(attempt * 400);
    }
  }

  throw new Error(
    `OpenAlex request failed after 3 attempts. URL=${url}. Details=${attemptErrors.join(" | ")}`
  );
}
