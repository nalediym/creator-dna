import type { ContentIdeasResponse } from "@creator-dna/core";

export function ContentIdeasSection({
  ideas,
}: {
  ideas: ContentIdeasResponse;
}) {
  const firstFive = ideas.ideas.slice(0, 5);
  const bonus = ideas.ideas.slice(5);

  return (
    <section className="py-16 animate-in fade-in duration-500">
      <div className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-6">
        03 — Your First 5 Videos
      </div>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-normal text-text-primary mb-2">
        Start here. This week.
      </h2>
      <p className="text-[13px] text-text-faint mb-6">
        Ordered from easiest to most ambitious. Video 1 is your easiest win.
      </p>

      <div className="space-y-3">
        {firstFive.map((idea, i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-xl p-5"
            style={i === 0 ? { borderLeftWidth: 3, borderLeftColor: "var(--accent)" } : undefined}
          >
            {i === 0 && (
              <div className="font-[family-name:var(--font-data)] text-[10px] text-accent mb-1">
                VIDEO 1 — Your Easiest Win
              </div>
            )}
            <h3 className="text-base text-text-primary mb-1">{idea.title}</h3>
            <p className="text-sm text-text-secondary italic mb-2">
              &ldquo;{idea.hook}&rdquo;
            </p>
            <span className="inline-block font-[family-name:var(--font-data)] text-[11px] text-text-faint bg-surface-raised px-2 py-0.5 rounded">
              {idea.format}
            </span>
          </div>
        ))}
      </div>

      {bonus.length > 0 && (
        <>
          <div className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted mt-10 mb-4">
            Bonus Ideas (Week 2+)
          </div>
          <div className="space-y-3">
            {bonus.map((idea, i) => (
              <div
                key={i}
                className="bg-surface border border-border rounded-xl p-5"
              >
                <h3 className="text-base text-text-primary mb-1">
                  {idea.title}
                </h3>
                <p className="text-sm text-text-secondary italic mb-2">
                  &ldquo;{idea.hook}&rdquo;
                </p>
                <span className="inline-block font-[family-name:var(--font-data)] text-[11px] text-text-faint bg-surface-raised px-2 py-0.5 rounded">
                  {idea.format}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
