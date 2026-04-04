"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CreatorDNAReport,
  NicheResponse,
  QualificationResponse,
  ContentIdeasResponse,
  ScheduleData,
  CreatorDNASummary,
} from "@creator-dna/core";
import { NicheSection } from "@/components/report/niche-section";
import { QualificationSection } from "@/components/report/qualification-section";
import { ContentIdeasSection } from "@/components/report/content-ideas-section";
import { ScheduleSection } from "@/components/report/schedule-section";
import { ReportHeader } from "@/components/report/report-header";
import { SectionSkeleton } from "@/components/report/section-skeleton";
import { ErrorBanner } from "@/components/report/error-banner";
import { ShareCard } from "@/components/report/share-card";
import { ReportFooter } from "@/components/report/report-footer";
import { ProgressDots } from "@/components/report/progress-dots";

interface StoredReport {
  niches: NicheResponse | null;
  qualification: QualificationResponse | null;
  contentIdeas: ContentIdeasResponse | null;
  schedule: ScheduleData;
  summary: CreatorDNASummary;
  errors?: {
    qualification: string | null;
    contentIdeas: string | null;
  };
}

export default function ReportPage() {
  const [report, setReport] = useState<StoredReport | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Try sessionStorage first (from live upload flow)
    const stored = sessionStorage.getItem("creator-dna-report");
    if (stored) {
      try {
        setReport(JSON.parse(stored));
        return;
      } catch { /* fall through */ }
    }

    // Fallback: load pre-generated sample report (from CLI)
    fetch("/sample-report.json")
      .then((res) => {
        if (!res.ok) throw new Error("No sample report");
        return res.json();
      })
      .then(setReport)
      .catch(() => router.push("/"));
  }, [router]);

  useEffect(() => {
    if (report) document.title = "Your Creator DNA Report";
  }, [report]);

  if (!report) {
    return (
      <main className="max-w-[680px] mx-auto px-6 py-16">
        <SectionSkeleton />
      </main>
    );
  }

  return (
    <main className="max-w-[680px] mx-auto px-6 py-16">
      <ProgressDots />
      <ReportHeader summary={report.summary} />

      <div className="divide-y divide-border-subtle">
        {report.niches ? (
          <NicheSection niches={report.niches} />
        ) : (
          <ErrorBanner message="Failed to identify niches." />
        )}

        {report.qualification ? (
          <QualificationSection qualification={report.qualification} />
        ) : report.errors?.qualification ? (
          <ErrorBanner message={report.errors.qualification} />
        ) : (
          <SectionSkeleton />
        )}

        {report.contentIdeas ? (
          <ContentIdeasSection ideas={report.contentIdeas} />
        ) : report.errors?.contentIdeas ? (
          <ErrorBanner message={report.errors.contentIdeas} />
        ) : (
          <SectionSkeleton />
        )}

        <ScheduleSection
          schedule={report.schedule}
          dayDistribution={report.summary.dayOfWeekDistribution}
          hourDistribution={report.summary.hourlyDistribution}
        />

        {report.niches && (
          <ShareCard niches={report.niches} summary={report.summary} />
        )}
      </div>

      <ReportFooter />
    </main>
  );
}
