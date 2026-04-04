"use client";

import Link from "next/link";

export function ReportFooter() {
  return (
    <section className="py-16 border-t border-border-subtle text-center">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-normal text-text-primary mb-3">
        You know what to create.
      </h2>
      <p className="font-[family-name:var(--font-display)] text-lg italic text-accent mb-8">
        Now go make it.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
        <a
          href="https://www.tiktok.com/creator-center"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-accent text-[#0a0a0a] rounded-lg font-medium text-sm hover:brightness-110 transition"
        >
          Open TikTok Creator Center
        </a>
        <Link
          href="/"
          className="px-6 py-3 border border-border text-text-secondary rounded-lg text-sm hover:border-accent transition-colors"
        >
          Analyze another export
        </Link>
      </div>

      <p className="text-[13px] text-text-faint max-w-[400px] mx-auto">
        Your first video doesn&apos;t need to be perfect. It needs to exist.
        Start with Video 1 above and post it today.
      </p>
    </section>
  );
}
