export type ClassificationResult = {
  category:
    | "diagnostics"
    | "neurotech"
    | "cardiovascular"
    | "surgical robotics"
    | "ai-device"
    | "implantables"
    | "imaging"
    | "drug delivery"
    | "unclassified";
  keywords: string[];
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  diagnostics: ["diagnostic", "biomarker", "screening", "assay", "point-of-care"],
  neurotech: ["neuro", "brain", "eeg", "neuromodulation", "seizure"],
  cardiovascular: ["cardio", "heart", "vascular", "arrhythmia", "stent"],
  "surgical robotics": ["surgical robot", "robotic surgery", "laparoscopic robot", "catheter robot"],
  "ai-device": ["machine learning", "artificial intelligence", "ai", "algorithm", "deep learning"],
  implantables: ["implant", "pacemaker", "neurostimulator", "prosthetic"],
  imaging: ["imaging", "ultrasound", "mri", "ct", "x-ray"],
  "drug delivery": ["drug delivery", "nanoparticle", "controlled release", "infusion"],
};

export function classifyOpportunity(text: string): ClassificationResult {
  const haystack = text.toLowerCase();

  let bestCategory: ClassificationResult["category"] = "unclassified";
  let bestMatches: string[] = [];

  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const matches = words.filter((w) => haystack.includes(w));
    if (matches.length > bestMatches.length) {
      bestCategory = category as ClassificationResult["category"];
      bestMatches = matches;
    }
  }

  return {
    category: bestCategory,
    keywords: bestMatches,
  };
}
