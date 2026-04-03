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
    const stored = sessionStorage.getItem("creator-dna-report");
    if (!stored) {
      router.push("/");
      return;
    }
    try {
      setReport(JSON.parse(stored));
    } catch {
      router.push("/");
    }
  }, [router]);

  if (!report) {
    return (
      <main className="max-w-[680px] mx-auto px-6 py-16">
        <SectionSkeleton />
      </main>
    );
  }

  return (
    <main className="max-w-[680px] mx-auto px-6 py-16">
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

        <ScheduleSection schedule={report.schedule} />
      </div>
    </main>
  );
}
