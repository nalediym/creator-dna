"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  diagnoseLocalAI,
  browserLabel,
  formatBytes,
  type DiagnoseStatus,
} from "@/lib/diagnose";
import { NanoDownloadButton } from "@/components/nano-download-button";

export default function DiagnosePage() {
  const [diag, setDiag] = useState<DiagnoseStatus | null>(null);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

  const run = useCallback(() => {
    void diagnoseLocalAI().then(setDiag);
  }, []);

  useEffect(() => {
    void diagnoseLocalAI().then(setDiag);
  }, []);

  const copyReport = useCallback(() => {
    if (!diag) return;
    const lines = [
      `status: ${diag.status}`,
      `browser: ${browserLabel(diag.browser)}`,
      `ua: ${ua}`,
      `secure-context: ${diag.device.isSecureContext}`,
      `mobile: ${diag.device.isMobile}`,
      `device-memory: ${diag.device.deviceMemoryGb ?? "?"} GB`,
      `cores: ${diag.device.cores ?? "?"}`,
      `storage-quota: ${formatBytes(diag.device.storageQuotaBytes)}`,
      `storage-usage: ${formatBytes(diag.device.storageUsageBytes)}`,
    ];
    void navigator.clipboard.writeText(lines.join("\n"));
  }, [diag, ua]);

  return (
    <main className="max-w-[680px] mx-auto px-6 py-16">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-text-faint hover:text-accent mb-8"
      >
        &larr; Back
      </Link>

      <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,5vw,2.75rem)] font-normal tracking-tight text-text-primary leading-[1.1] mb-3">
        Diagnostics
      </h1>
      <p className="text-text-secondary text-[15px] leading-relaxed mb-10">
        Everything Creator DNA can detect about your browser&rsquo;s on-device
        AI. If you&rsquo;re stuck, copy this report into an issue and we can
        help.
      </p>

      {!diag ? (
        <div className="text-text-faint text-sm">Running checks...</div>
      ) : (
        <>
          <Section title="Status">
            <Row k="Result" v={diag.status} mono />
            <Row k="Browser" v={browserLabel(diag.browser)} />
          </Section>

          <Section title="Environment">
            <Row k="Secure context" v={String(diag.device.isSecureContext)} />
            <Row k="Mobile" v={String(diag.device.isMobile)} />
            <Row
              k="Device memory"
              v={
                diag.device.deviceMemoryGb != null
                  ? `${diag.device.deviceMemoryGb} GB`
                  : "—"
              }
            />
            <Row k="CPU cores" v={diag.device.cores != null ? String(diag.device.cores) : "—"} />
            <Row k="Storage quota" v={formatBytes(diag.device.storageQuotaBytes)} />
            <Row k="Storage in use" v={formatBytes(diag.device.storageUsageBytes)} />
          </Section>

          <Section title="User agent">
            <pre className="bg-surface border border-border rounded-xl p-3 text-[11px] font-[family-name:var(--font-data)] text-text-muted break-all whitespace-pre-wrap">
              {ua}
            </pre>
          </Section>

          <Section title="Next step">
            <p className="text-text-secondary text-sm">{nextStep(diag)}</p>

            {(diag.status === "downloadable" || diag.status === "downloading") && (
              <div className="mt-4">
                <NanoDownloadButton
                  onReady={run}
                  initialDownloading={diag.status === "downloading"}
                />
              </div>
            )}

            {diag.status === "api-missing" && (
              <ol className="mt-3 text-[13px] text-text-secondary space-y-1.5 list-decimal list-inside">
                <li>
                  Copy{" "}
                  <code className="font-[family-name:var(--font-data)] text-accent">
                    chrome://flags/#prompt-api-for-gemini-nano
                  </code>{" "}
                  into your address bar
                </li>
                <li>
                  Set it to <strong>Enabled</strong> and click Relaunch
                </li>
                <li>Come back here — the page will offer a one-click download</li>
              </ol>
            )}
          </Section>

          <div className="flex flex-wrap gap-3 text-[13px] mt-8">
            <button
              onClick={run}
              className="text-accent underline hover:no-underline"
            >
              Re-run checks
            </button>
            <button
              onClick={copyReport}
              className="text-accent underline hover:no-underline"
            >
              Copy report
            </button>
            <Link
              href="/"
              className="text-text-faint underline hover:text-accent"
            >
              Back to upload
            </Link>
          </div>
        </>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-3">
        {title}
      </h2>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm border-b border-border-subtle py-1.5">
      <span className="text-text-secondary">{k}</span>
      <span
        className={
          mono
            ? "text-text-primary font-[family-name:var(--font-data)]"
            : "text-text-primary"
        }
      >
        {v}
      </span>
    </div>
  );
}

function nextStep(d: DiagnoseStatus): string {
  switch (d.status) {
    case "available":
      return "You're ready. Head back to the upload page and drop your TikTok export.";
    case "downloadable":
      return "Chrome can fetch the on-device model. Click the button below to start the one-time download.";
    case "downloading":
      return "Download in progress. Leave the tab open — this page will switch to ready when it's done.";
    case "wrong-browser":
      return "Open this URL in Chrome 138+ or Edge — other browsers don't expose the on-device AI API yet.";
    case "mobile":
      return "Switch to a desktop or laptop running Chrome or Edge.";
    case "outdated-chrome":
      return `Update to Chrome ${d.minRequired}+. Open chrome://settings/help to update.`;
    case "insecure-context":
      return "Reload this page over HTTPS. The Prompt API is hidden in insecure contexts.";
    case "api-missing":
      return "Enable the chrome://flags flag below, restart Chrome, and download the model from chrome://components.";
    case "hardware-fail":
      return "Chrome reports the on-device model as unavailable on this device. Most often that means insufficient free disk (~22 GB) or a GPU below ~4 GB.";
  }
}

