"use client";

import { useEffect, useRef } from "react";
import type { NicheResponse } from "@creator-dna/core";

export function NicheSection({ niches }: { niches: NicheResponse }) {
  return (
    <section className="py-16 animate-in fade-in duration-500">
      <div className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-6">
        01 — Your Niches
      </div>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-normal text-text-primary mb-6">
        You&apos;re not &ldquo;into everything.&rdquo; You&apos;re deep in{" "}
        {niches.niches.length} spaces.
      </h2>

      <div className="space-y-4">
        {niches.niches.map((niche, i) => (
          <NicheCard key={i} niche={niche} />
        ))}
      </div>
    </section>
  );
}

function NicheCard({
  niche,
}: {
  niche: { name: string; confidence: number; evidence: string[] };
}) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Animate confidence bar from 0 to value
    const timer = setTimeout(() => {
      if (barRef.current) {
        barRef.current.style.width = `${niche.confidence}%`;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [niche.confidence]);

  return (
    <div className="pb-4 border-b border-border-subtle last:border-b-0">
      <h3 className="font-[family-name:var(--font-display)] text-xl text-text-primary mb-2">
        {niche.name}
      </h3>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-[3px] bg-border rounded-full overflow-hidden">
          <div
            ref={barRef}
            className="h-full bg-accent rounded-full transition-[width] duration-700 ease-out"
            style={{ width: "0%" }}
          />
        </div>
        <span className="font-[family-name:var(--font-data)] text-[13px] text-accent w-10 text-right">
          {niche.confidence}%
        </span>
      </div>
      <p className="text-[13px] text-text-muted">
        {niche.evidence.map((e, i) => (
          <span key={i}>
            {i > 0 && " "}
            {e}
            {i < niche.evidence.length - 1 && "."}
          </span>
        ))}
      </p>
    </div>
  );
}
