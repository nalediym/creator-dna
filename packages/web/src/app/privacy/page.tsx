import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="max-w-[680px] mx-auto px-6 py-16">
      <Link
        href="/"
        className="text-accent text-sm hover:text-text-primary transition-colors"
      >
        &larr; Back
      </Link>

      <h1 className="font-[family-name:var(--font-display)] text-[2rem] font-normal text-text-primary mt-8 mb-6">
        Your data stays yours.
      </h1>

      <div className="space-y-8 text-text-secondary text-[15px] leading-relaxed">
        <section>
          <h2 className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-3">
            What happens when you upload
          </h2>
          <p>
            Your TikTok export file is parsed entirely in your browser using a
            Web Worker. The raw JSON never leaves your device. We extract only
            aggregated statistics and send those to our server for AI analysis.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-3">
            What we read from your export
          </h2>
          <ul className="space-y-1 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-success mt-0.5">&#10003;</span>
              Watch history (timestamps and video counts only)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success mt-0.5">&#10003;</span>
              Liked videos (counts and ratios)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success mt-0.5">&#10003;</span>
              Favorited videos (counts)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success mt-0.5">&#10003;</span>
              Search terms (aggregated by frequency)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success mt-0.5">&#10003;</span>
              Share history (method breakdown only)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success mt-0.5">&#10003;</span>
              Following list (grouped into categories, not individual usernames)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-destructive mb-3">
            What we never read
          </h2>
          <ul className="space-y-1 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-destructive mt-0.5">&#10007;</span>
              Direct messages
            </li>
            <li className="flex items-start gap-2">
              <span className="text-destructive mt-0.5">&#10007;</span>
              Login history, IP addresses
            </li>
            <li className="flex items-start gap-2">
              <span className="text-destructive mt-0.5">&#10007;</span>
              Profile info, settings
            </li>
            <li className="flex items-start gap-2">
              <span className="text-destructive mt-0.5">&#10007;</span>
              Individual video URLs
            </li>
            <li className="flex items-start gap-2">
              <span className="text-destructive mt-0.5">&#10007;</span>
              Individual usernames you follow
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-3">
            What we send to our server
          </h2>
          <p className="mb-3">
            Only an aggregated summary (~2KB) is sent to generate your report.
            Here&apos;s the exact shape of the data:
          </p>
          <pre className="bg-surface border border-border rounded-xl p-4 text-xs font-[family-name:var(--font-data)] text-text-muted overflow-x-auto">
{`{
  searchClusters: [
    { term: "cecred", count: 12, firstSeen: "...", lastSeen: "..." }
  ],
  stats: {
    videosWatched: 22429,
    videosLiked: 6000,
    videosFavorited: 3585,
    videosShared: 941,
    searchesCount: 1311,
    accountsFollowed: 2349
  },
  hourlyDistribution: { 0: 342, 1: 289, ... },
  dayOfWeekDistribution: { Monday: 3100, ... },
  likeToWatchRatio: 0.267,
  favoriteToLikeRatio: 0.597,
  shareMethodBreakdown: { "Copy Link": 412, ... },
  creatorCategories: [
    { category: "hair-care", count: 23, sampleUsernames: [] }
  ]
}`}
          </pre>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-3">
            Data retention
          </h2>
          <p>
            Nothing is stored. No accounts, no cookies, no tracking. The
            aggregated summary exists in server memory only during the analysis
            call and is discarded immediately after. We don&apos;t even know
            you were here.
          </p>
        </section>
      </div>
    </main>
  );
}
