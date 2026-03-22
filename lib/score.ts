import { classifyOpportunity } from "./classify";

const TRANSLATIONAL_HIGH_TERMS = ["clinical trial", "fda", "first-in-human", "porcine model", "510(k)", "ce mark"];
const TRANSLATIONAL_MEDIUM_TERMS = ["prototype", "preclinical", "animal model", "proof-of-concept"];
const TRANSLATIONAL_LOW_TERMS = ["in vitro", "simulation", "computational model"];

const CATEGORY_FIT: Record<string, number> = {
  "ai-device": 10,
  neurotech: 10,
  diagnostics: 9,
  imaging: 8,
  cardiovascular: 7,
  "drug delivery": 5,
};

export type ScoreInput = {
  date: string | null;
  cited_by_count: number;
  title: string;
  abstract: string | null;
  institutions: string;
};

export type ScoreBreakdown = {
  translational_momentum: number;
  pi_track_record: number;
  patent_paper_overlap: number;
  institution_strength: number;
  category_fit: number;
  recency_velocity: number;
  total: number;
  // legacy aliases used by current ingestion schema
  novelty: number;
  momentum: number;
  commercial: number;
  institution: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreTranslationalMomentum(text: string): number {
  const lower = text.toLowerCase();

  let score = 0;
  for (const term of TRANSLATIONAL_HIGH_TERMS) {
    if (lower.includes(term.toLowerCase())) score += 6;
  }
  for (const term of TRANSLATIONAL_MEDIUM_TERMS) {
    if (lower.includes(term.toLowerCase())) score += 3;
  }
  for (const term of TRANSLATIONAL_LOW_TERMS) {
    if (lower.includes(term.toLowerCase())) score -= 2;
  }

  return clamp(score, 0, 30);
}

function scoreInstitutionStrength(institutions: string): number {
  const lower = institutions.toLowerCase();
  if (lower.includes("md anderson") || lower.includes("baylor") || lower.includes("rice")) return 10;
  if (lower.includes("uthealth")) return 7;
  return 3;
}

function scoreCategoryFit(text: string): number {
  const category = classifyOpportunity(text).category;
  return CATEGORY_FIT[category] ?? 4;
}

function scoreRecencyVelocity(date: string | null, citedByCount: number): number {
  if (!date) return 0;

  const published = new Date(date);
  if (Number.isNaN(published.getTime())) return 0;

  const ageInDays = Math.max(1, Math.floor((Date.now() - published.getTime()) / (1000 * 60 * 60 * 24)));
  const ageInMonths = Math.max(ageInDays / 30.4375, 0.1);

  let score = citedByCount / ageInMonths;
  if (ageInMonths < 6) score += 3;

  return clamp(score, 0, 10);
}

export function scoreOpportunity(input: ScoreInput): ScoreBreakdown {
  const text = `${input.title} ${input.abstract ?? ""}`;

  const translational = scoreTranslationalMomentum(text);
  const institution = scoreInstitutionStrength(input.institutions);
  const category = scoreCategoryFit(text);
  const recency = scoreRecencyVelocity(input.date, input.cited_by_count);

  const piTrackRecord = 0;
  const patentPaperOverlap = 0;

  const total =
    translational * 0.3 +
    piTrackRecord * 0.25 +
    patentPaperOverlap * 0.15 +
    institution * 0.1 +
    category * 0.1 +
    recency * 0.1;

  return {
    translational_momentum: Number(translational.toFixed(2)),
    pi_track_record: piTrackRecord,
    patent_paper_overlap: patentPaperOverlap,
    institution_strength: Number(institution.toFixed(2)),
    category_fit: Number(category.toFixed(2)),
    recency_velocity: Number(recency.toFixed(2)),
    total: Number(total.toFixed(2)),
    novelty: Number(translational.toFixed(2)),
    momentum: Number(recency.toFixed(2)),
    commercial: Number(category.toFixed(2)),
    institution: Number(institution.toFixed(2)),
  };
}
