import type { QualificationResponse } from "@creator-dna/core";

export function QualificationSection({
  qualification,
}: {
  qualification: QualificationResponse;
}) {
  return (
    <section id="qualified" className="py-16 animate-in fade-in duration-500">
      <div className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-6">
        02 — Why You&apos;re Qualified
      </div>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-normal text-text-primary mb-6">
        You know more than you think.
      </h2>

      <div className="space-y-5">
        {qualification.qualifications.map((qual, i) => (
          <div
            key={i}
            className="border-l-[3px] border-accent pl-6 py-5 rounded-r-lg"
            style={{
              background:
                "linear-gradient(135deg, var(--surface-raised) 0%, var(--surface) 100%)",
            }}
          >
            {/* Stats as visual anchors */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-3">
              {qual.stats.map((stat, j) => (
                <div key={j} className="font-[family-name:var(--font-data)] text-sm text-accent">
                  {stat}
                </div>
              ))}
            </div>

            {/* Niche label */}
            <div className="text-xs text-text-muted mb-2 uppercase tracking-wider">
              {qual.niche}
            </div>

            {/* Shortened narrative — limit to first 2-3 sentences */}
            <p className="text-sm text-text-secondary leading-relaxed">
              {truncateNarrative(qual.narrative)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function truncateNarrative(text: string): string {
  // Show first 2-3 sentences to avoid text walls
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  if (sentences.length <= 3) return text;
  return sentences.slice(0, 3).join("").trim();
}
