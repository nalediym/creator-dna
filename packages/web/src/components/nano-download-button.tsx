import { useCallback, useState } from "react";
import { startNanoDownload } from "@/lib/local-ai-download";

type DownloadState =
  | { kind: "idle" }
  | { kind: "downloading"; fraction: number }
  | { kind: "ready" }
  | { kind: "error"; message: string };

type Props = {
  /** Called once the model is fully downloaded and ready to prompt. */
  onReady: () => void;
  /** Optional: change the button label (e.g. for an inline diagnose-page CTA). */
  label?: string;
  /** If the page already detected `downloading`, render with the bar from the start. */
  initialDownloading?: boolean;
};

export function NanoDownloadButton({ onReady, label, initialDownloading }: Props) {
  const [state, setState] = useState<DownloadState>(
    initialDownloading ? { kind: "downloading", fraction: 0 } : { kind: "idle" },
  );

  const trigger = useCallback(() => {
    setState({ kind: "downloading", fraction: 0 });
    void startNanoDownload({
      onProgress(fraction) {
        setState({ kind: "downloading", fraction });
      },
      onReady() {
        setState({ kind: "ready" });
        onReady();
      },
      onError(err) {
        setState({ kind: "error", message: err.message });
      },
    });
  }, [onReady]);

  if (state.kind === "downloading") {
    const pct = Math.round(state.fraction * 100);
    return (
      <div className="w-full">
        <div className="flex justify-between text-[12px] text-text-faint mb-1.5">
          <span>Downloading on-device model</span>
          <span className="font-[family-name:var(--font-data)]">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-accent transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[11px] text-text-faint mt-2">
          ~2 GB on first run. Safe to leave this tab open.
        </div>
      </div>
    );
  }

  if (state.kind === "ready") {
    return (
      <div className="text-[13px] text-success">
        ✓ On-device model ready.
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div>
        <button
          onClick={trigger}
          className="px-4 py-2.5 rounded-lg bg-accent text-bg-base text-sm font-medium hover:opacity-90"
        >
          Try again
        </button>
        <div className="text-[12px] text-destructive mt-2">{state.message}</div>
      </div>
    );
  }

  return (
    <button
      onClick={trigger}
      className="px-4 py-2.5 rounded-lg bg-accent text-bg-base text-sm font-medium hover:opacity-90"
    >
      {label ?? "Download local AI (~2 GB)"}
    </button>
  );
}
