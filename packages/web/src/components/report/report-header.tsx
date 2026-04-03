import type { CreatorDNASummary } from "@creator-dna/core";

export function ReportHeader({ summary }: { summary: CreatorDNASummary }) {
  const { videosWatched, videosLiked, searchesCount } = summary.stats;

  return (
    <div className="text-center mb-12 pb-8 border-b border-border-subtle">
      <h1 className="font-[family-name:var(--font-display)] text-[2rem] font-normal text-text-primary mb-2">
        Your Creator DNA
      </h1>
      <span className="inline-block font-[family-name:var(--font-data)] text-xs text-text-muted bg-surface px-3 py-1 rounded-full">
        Based on {videosWatched.toLocaleString()} videos &middot;{" "}
        {videosLiked.toLocaleString()} likes &middot;{" "}
        {searchesCount.toLocaleString()} searches
      </span>
    </div>
  );
}
