import type {
  ContentIdeasResponse,
  CreatorDNASummary,
  NicheResponse,
  QualificationResponse,
} from "@creator-dna/core";

export interface CloudAnalysisResult {
  niches: NicheResponse | null;
  qualification: QualificationResponse | null;
  contentIdeas: ContentIdeasResponse | null;
  errors: { qualification: string | null; contentIdeas: string | null };
  meta?: {
    runner: string;
    mode: string;
    model: string;
    total_ms: number;
    timings: Array<{ label: string; elapsed_ms: number }>;
  };
}

export async function analyzeInCloud(
  summary: CreatorDNASummary,
): Promise<CloudAnalysisResult> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary, mode: "one_pass" }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Cloud analysis failed (${response.status})`);
  }

  return (await response.json()) as CloudAnalysisResult;
}

export function isCloudAnalysisEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FAST_CLOUD_ENABLED === "true";
}
