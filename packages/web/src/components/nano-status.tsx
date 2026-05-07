import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  diagnoseLocalAI,
  browserLabel,
  type DiagnoseStatus,
} from "@/lib/diagnose";
import { NanoDownloadButton } from "@/components/nano-download-button";
import { trackHomeLoaded } from "@/lib/track";

type Props = {
  /** Children render only when local AI is `available`. */
  children: React.ReactNode;
};

export function NanoGate({ children }: Props) {
  const [diag, setDiag] = useState<DiagnoseStatus | null>(null);

  const run = useCallback(() => {
    void diagnoseLocalAI().then(setDiag);
  }, []);

  useEffect(() => {
    void diagnoseLocalAI().then((d) => {
      setDiag(d);
      trackHomeLoaded(d.status);
    });
  }, []);

  if (!diag) {
    return (
      <div className="border-2 border-dashed border-border rounded-[16px] p-12 max-w-[500px] w-full mx-auto text-center">
        <div className="text-text-faint text-sm">Checking your browser...</div>
      </div>
    );
  }

  if (diag.status === "available") return <>{children}</>;

  return <NanoStatusCard diag={diag} onRetry={run} />;
}

function NanoStatusCard({
  diag,
  onRetry,
}: {
  diag: DiagnoseStatus;
  onRetry: () => void;
}) {
  const content = renderForStatus(diag);
  const showDownload = diag.status === "downloadable" || diag.status === "downloading";

  return (
    <div className="max-w-[500px] w-full mx-auto border-2 border-dashed border-border rounded-[16px] p-8 text-left">
      <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-2">
        {content.tag}
      </div>
      <h2 className="font-[family-name:var(--font-display)] text-xl text-text-primary mb-3">
        {content.headline}
      </h2>
      <p className="text-text-secondary text-sm leading-relaxed mb-4">
        {content.body}
      </p>

      {content.steps && (
        <ol className="text-[13px] text-text-secondary space-y-1.5 mb-4 list-decimal list-inside">
          {content.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}

      {showDownload && (
        <div className="mb-4">
          <NanoDownloadButton
            onReady={onRetry}
            initialDownloading={diag.status === "downloading"}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <button
          onClick={onRetry}
          className="text-accent underline hover:no-underline"
        >
          Re-check
        </button>
        <Link to="/diagnose" className="text-text-faint underline hover:text-accent">
          Full diagnostics
        </Link>
        <Link to="/privacy" className="text-text-faint underline hover:text-accent">
          Why on-device?
        </Link>
      </div>

      <div className="mt-4 pt-3 border-t border-border-subtle text-[11px] text-text-faint">
        Detected: {browserLabel(diag.browser)} · status:{" "}
        <span className="font-[family-name:var(--font-data)]">{diag.status}</span>
      </div>
    </div>
  );
}

interface RenderedStatus {
  tag: string;
  headline: string;
  body: string;
  steps?: string[];
}

function renderForStatus(diag: DiagnoseStatus): RenderedStatus {
  switch (diag.status) {
    case "wrong-browser":
      return {
        tag: "Wrong browser",
        headline: "Open this in Chrome or Edge.",
        body:
          "Creator DNA runs entirely in your browser using Chrome's on-device AI (Gemini Nano). Your TikTok export never leaves your laptop. Other browsers don't ship this API yet — Chrome 138+ or Edge are required.",
      };
    case "mobile":
      return {
        tag: "Desktop only",
        headline: "Mobile isn't supported yet.",
        body:
          "Chrome's on-device AI doesn't ship on mobile. Open this URL on a desktop or laptop running Chrome 138+ or Edge.",
      };
    case "outdated-chrome":
      return {
        tag: "Update Chrome",
        headline: `You're on an older Chrome (${diag.browser.kind === "chrome" || diag.browser.kind === "edge" ? diag.browser.major : "?"}).`,
        body: `Creator DNA needs Chrome ${diag.minRequired}+ for the on-device AI API. Update Chrome, then come back.`,
        steps: [
          "Open chrome://settings/help (copy and paste — Chrome blocks links to chrome:// URLs)",
          "Let Chrome update, then restart it",
          "Click Re-check below",
        ],
      };
    case "insecure-context":
      return {
        tag: "Insecure context",
        headline: "This page must be served over HTTPS.",
        body:
          "Chrome's on-device AI is only exposed on HTTPS pages (or localhost). The current page isn't secure, so the API is hidden. If you arrived via an http:// link, try the https:// version.",
      };
    case "api-missing":
      return {
        tag: "Enable the AI API",
        headline: "Chrome has the model, but the API isn't exposed yet.",
        body:
          "Your Chrome version supports it, but the Prompt API is gated behind a flag for now. Enable it, restart, and come back.",
        steps: [
          "Copy chrome://flags/#prompt-api-for-gemini-nano into your address bar",
          'Set it to "Enabled" and click Relaunch',
          "Then visit chrome://components and click Check for update on Optimization Guide On Device Model",
          "Wait for the download (~2 GB), then click Re-check",
        ],
      };
    case "downloadable":
      return {
        tag: "One-time setup",
        headline: "Download the on-device model to get started.",
        body:
          "Your browser is ready — it just hasn't fetched Gemini Nano yet. Click below and Chrome will download it once. After that everything runs on your laptop, including future analyses.",
      };
    case "downloading":
      return {
        tag: "Downloading",
        headline: "Chrome is fetching the on-device model.",
        body:
          "First-time setup downloads ~2 GB. Once it finishes, this page will switch to the upload flow automatically.",
      };
    case "hardware-fail":
      return {
        tag: "Hardware check",
        headline: "Your device may not meet the on-device AI requirements.",
        body:
          "Chrome reports the on-device model as unavailable on this machine. The usual causes are insufficient free disk (~22 GB needed) or a GPU below ~4 GB. If you've changed those recently, click Re-check.",
        steps: [
          `RAM: ${diag.device.deviceMemoryGb ?? "?"} GB`,
          `CPU cores: ${diag.device.cores ?? "?"}`,
          `Storage quota for this site: ${
            diag.device.storageQuotaBytes != null
              ? `${(diag.device.storageQuotaBytes / 1024 / 1024 / 1024).toFixed(1)} GB`
              : "?"
          }`,
        ],
      };
    case "available":
      // Unreachable — caller renders children instead.
      return { tag: "", headline: "", body: "" };
  }
}
