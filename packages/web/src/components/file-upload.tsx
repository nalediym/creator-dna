import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { unzipSync } from "fflate";
import { isLocalAIAvailable, analyzeLocally } from "@/lib/local-ai";
import {
  trackUploadStarted,
  trackAnalysisStarted,
} from "@/lib/track";
import type { ParseWorkerResult, ParseWorkerError } from "@/workers/parse-worker";

type UploadState =
  | { status: "idle" }
  | { status: "parsing"; fileName: string }
  | { status: "analyzing" }
  | { status: "error"; message: string };

export function FileUpload() {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const processFile = useCallback(
    async (file: File) => {
      const isZip = file.name.endsWith(".zip");
      const isJson = file.name.endsWith(".json");

      if (!isZip && !isJson) {
        setState({
          status: "error",
          message:
            "Please upload your TikTok data export (.zip or .json).",
        });
        return;
      }

      setState({ status: "parsing", fileName: file.name });
      const parseSourceStart = performance.now();

      try {
        let text: string;

        if (isZip) {
          // Extract JSON from TikTok ZIP export
          const buffer = await file.arrayBuffer();
          const unzipped = unzipSync(new Uint8Array(buffer));
          const jsonFile = Object.keys(unzipped).find((name) =>
            name.endsWith(".json"),
          );
          if (!jsonFile) {
            setState({
              status: "error",
              message:
                "No JSON file found inside the ZIP. Make sure this is a TikTok data export.",
            });
            return;
          }
          text = new TextDecoder().decode(unzipped[jsonFile]);
        } else {
          text = await file.text();
        }

        trackUploadStarted(performance.now() - parseSourceStart);

        // Parse in Web Worker to avoid blocking the main thread
        const worker = new Worker(
          new URL("@/workers/parse-worker.ts", import.meta.url),
        );

        worker.onmessage = async (
          event: MessageEvent<ParseWorkerResult | ParseWorkerError>,
        ) => {
          worker.terminate();
          const result = event.data;

          if (!result.ok) {
            setState({ status: "error", message: result.error });
            return;
          }

          setState({ status: "analyzing" });

          try {
            // Local-only architecture: Gemini Nano (Chrome built-in, on-device).
            // Nothing about your TikTok export ever leaves the laptop.
            const localAvailable = await isLocalAIAvailable();
            if (!localAvailable) {
              setState({
                status: "error",
                message:
                  "On-device AI became unavailable mid-flow. Refresh the page — the homepage will walk you through fixing it.",
              });
              return;
            }

            console.log("[Creator DNA] Using local AI (Gemini Nano) — fully on-device");
            const summaryBytes = JSON.stringify(result.summary).length;
            trackAnalysisStarted(summaryBytes);
            const analysis = await analyzeLocally(result.summary);

            if (!analysis?.niches) {
              setState({
                status: "error",
                message:
                  "Local analysis didn't return results. This usually clears with a page refresh. If it persists, please open an issue.",
              });
              return;
            }

            // Store analysis result in sessionStorage for the report page
            sessionStorage.setItem(
              "creator-dna-report",
              JSON.stringify({
                ...analysis,
                summary: result.summary,
                schedule: result.schedule,
              }),
            );

            navigate("/report");
          } catch {
            setState({
              status: "error",
              message: "Analysis failed. Please try again.",
            });
          }
        };

        worker.onerror = () => {
          worker.terminate();
          setState({
            status: "error",
            message: "Failed to process file. Please try again.",
          });
        };

        worker.postMessage(text);
      } catch {
        setState({
          status: "error",
          message: "Could not read the file. Please try again.",
        });
      }
    },
    [navigate],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dropZoneRef.current?.classList.remove("border-accent", "bg-accent-glow");
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dropZoneRef.current?.classList.add("border-accent", "bg-accent-glow");
  }, []);

  const handleDragLeave = useCallback(() => {
    dropZoneRef.current?.classList.remove("border-accent", "bg-accent-glow");
  }, []);

  if (state.status === "parsing") {
    return (
      <div className="border-2 border-dashed border-border rounded-[16px] p-12 max-w-[500px] w-full mx-auto text-center">
        <div className="text-text-secondary mb-2">
          Parsing <span className="text-accent">{state.fileName}</span> locally...
        </div>
        <div className="text-[13px] text-text-faint">
          Your data stays in your browser.
        </div>
      </div>
    );
  }

  if (state.status === "analyzing") {
    return (
      <div className="border-2 border-dashed border-accent rounded-[16px] p-12 max-w-[500px] w-full mx-auto text-center">
        <div className="text-text-secondary mb-2">
          Analyzing your Creator DNA...
        </div>
        <div className="text-[13px] text-text-faint">
          Running on-device AI. Nothing leaves your browser.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[500px] w-full mx-auto">
      <div
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload TikTok data export"
        className="border-2 border-dashed border-border rounded-[16px] p-12 cursor-pointer transition-colors duration-300 hover:border-accent hover:bg-accent-glow"
      >
        <div className="text-2xl mb-3 opacity-50">&uarr;</div>
        <div className="text-base text-text-secondary">
          Drop your{" "}
          <span className="text-accent font-medium">
            TikTok data export
          </span>{" "}
          here
        </div>
        <div className="text-[13px] text-text-faint mt-2">
          .zip or .json &middot; Settings &rarr; Privacy &rarr; Download your data
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".json,.zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
        }}
      />

      {state.status === "error" && (
        <div className="mt-4 p-4 rounded-lg bg-[rgba(212,102,90,0.1)] border-l-[3px] border-destructive text-destructive text-sm">
          {state.message}
        </div>
      )}
    </div>
  );
}
