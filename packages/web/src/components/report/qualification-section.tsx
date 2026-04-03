import type { QualificationResponse } from "@creator-dna/core";

export function QualificationSection({
  qualification,
}: {
  qualification: QualificationResponse;
}) {
  return (
    <section className="py-16 animate-in fade-in duration-500">
      <div className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-6">
        02 — Why You&apos;re Qualified
      </div>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-normal text-text-primary mb-6">
        You know more than you think.
      </h2>

      <div className="space-y-4">
        {qualification.qualifications.map((qual, i) => (
          <div
            key={i}
            className="border-l-[3px] border-accent pl-6 py-5 rounded-r-lg"
            style={{
              background:
                "linear-gradient(135deg, var(--surface-raised) 0%, var(--surface) 100%)",
            }}
          >
            {qual.stats[0] && (
              <div className="font-[family-name:var(--font-data)] text-[2rem] font-light text-accent leading-none mb-1">
                {qual.stats[0]}
              </div>
            )}
            <p className="text-sm text-text-secondary">{qual.narrative}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
