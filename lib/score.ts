const STRONG_INSTITUTIONS = [
  "rice university",
  "baylor college of medicine",
  "uthealth",
  "md anderson",
  "texas medical center",
];

const COMMERCIAL_KEYWORDS = [
  "prototype",
  "commercial",
  "startup",
  "clinical",
  "translation",
  "fda",
  "device",
  "platform",
];

export type ScoreInput = {
  date: string | null;
  cited_by_count: number;
  title: string;
  abstract: string | null;
  institutions: string;
};

export type ScoreBreakdown = {
  novelty: number;
  momentum: number;
  commercial: number;
  institution: number;
  total: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function scoreOpportunity(input: ScoreInput): ScoreBreakdown {
  const today = new Date();
  const published = input.date ? new Date(input.date) : null;

  const ageInDays = published
    ? Math.max(0, Math.floor((today.getTime() - published.getTime()) / (1000 * 60 * 60 * 24)))
    : 365;

  const novelty = clamp(35 - ageInDays / 10, 0, 35);
  const momentum = clamp(Math.log10(Math.max(1, input.cited_by_count) + 1) * 20, 0, 20);

  const text = `${input.title} ${input.abstract ?? ""}`.toLowerCase();
  const commercialHits = COMMERCIAL_KEYWORDS.filter((w) => text.includes(w)).length;
  const commercial = clamp(commercialHits * 5, 0, 25);

  const institutions = input.institutions.toLowerCase();
  const institutionHits = STRONG_INSTITUTIONS.filter((inst) => institutions.includes(inst)).length;
  const institution = clamp(institutionHits * 10, 0, 20);

  const total = clamp(novelty + momentum + commercial + institution, 0, 100);

  return {
    novelty: Number(novelty.toFixed(2)),
    momentum: Number(momentum.toFixed(2)),
    commercial: Number(commercial.toFixed(2)),
    institution: Number(institution.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}
