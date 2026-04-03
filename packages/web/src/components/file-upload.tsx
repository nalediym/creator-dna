"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".json")) {
        setState({
          status: "error",
          message: "Please upload a JSON file. TikTok exports are in JSON format.",
        });
        return;
      }

      setState({ status: "parsing", fileName: file.name });

      try {
        const text = await file.text();

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
            const res = await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                summary: result.summary,
                schedule: result.schedule,
              }),
            });

            if (!res.ok) {
              const errorData = await res.json().catch(() => null);
              setState({
                status: "error",
                message:
                  errorData?.error ||
                  `Analysis failed (${res.status}). Please try again.`,
              });
              return;
            }

            // Store analysis result in sessionStorage for the report page
            const analysis = await res.json();
            sessionStorage.setItem(
              "creator-dna-report",
              JSON.stringify({
                ...analysis,
                summary: result.summary,
                schedule: result.schedule,
              }),
            );

            router.push("/report");
          } catch {
            setState({
              status: "error",
              message: "Network error. Please check your connection and try again.",
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
    [router],
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
          This takes about 10 seconds.
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
            user_data_tiktok.json
          </span>{" "}
          here
        </div>
        <div className="text-[13px] text-text-faint mt-2">
          Settings &rarr; Privacy &rarr; Download your data &rarr; JSON
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".json"
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
