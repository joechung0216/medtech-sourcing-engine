export type PatentOpportunity = {
  id: string;
  source: "patent";
  title: string;
  abstract: string;
  authors: string;
  institutions: string;
  date: string;
  doi: string | null;
  url: string;
  cited_by_count: number;
  raw: unknown;
};

export async function fetchPatentOpportunitiesStub(): Promise<PatentOpportunity[]> {
  const now = new Date();
  const toDate = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  return [
    {
      id: "patent:mock-1",
      source: "patent",
      title: "Catheter-integrated AI guidance for real-time cardiac ablation",
      abstract:
        "A system combining catheter sensors and machine learning to support safer ablation in electrophysiology labs.",
      authors: "Mock Inventor A",
      institutions: "Houston MedTech Ventures",
      date: toDate(5),
      doi: null,
      url: "https://example.com/patents/mock-1",
      cited_by_count: 2,
      raw: { provider: "stub" },
    },
    {
      id: "patent:mock-2",
      source: "patent",
      title: "Implantable neurostimulator with closed-loop seizure detection",
      abstract:
        "An implantable neurotech platform that classifies EEG patterns and automatically adjusts stimulation parameters.",
      authors: "Mock Inventor B",
      institutions: "Texas Neuro Devices",
      date: toDate(12),
      doi: null,
      url: "https://example.com/patents/mock-2",
      cited_by_count: 1,
      raw: { provider: "stub" },
    },
    {
      id: "patent:mock-3",
      source: "patent",
      title: "Portable ultrasound imaging probe for low-resource diagnostics",
      abstract:
        "A compact ultrasound imaging system for point-of-care diagnostics with AI-assisted image enhancement.",
      authors: "Mock Inventor C",
      institutions: "Rice University",
      date: toDate(25),
      doi: null,
      url: "https://example.com/patents/mock-3",
      cited_by_count: 0,
      raw: { provider: "stub" },
    },
  ];
}
