"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { unzipSync } from "fflate";
import { isLocalAIAvailable, analyzeLocally } from "@/lib/local-ai";
import type { ParseWorkerResult, ParseWorkerError } from "@/workers/parse-worker";

// Pattern that matches TikTok's data-export filenames as they ship from
// the takeout flow. Both the zipped and unzipped variants land in Downloads.
const TIKTOK_EXPORT_PATTERN = /^(user_data_tiktok.*\.json|tiktok.*\.zip)$/i;

type UploadState =
  | { status: "idle" }
  | { status: "parsing"; fileName: string }
  | { status: "analyzing" }
  | { status: "watching"; folderName: string }
  | { status: "error"; message: string };

// File System Access API is Chrome/Edge only. Window typing for it is in
// the Web Platform spec but not in lib.dom.d.ts; declare just enough.
declare global {
  interface Window {
    showDirectoryPicker?: (opts?: {
      id?: string;
      mode?: "read" | "readwrite";
      startIn?: "downloads" | "documents" | "desktop";
    }) => Promise<FileSystemDirectoryHandle>;
  }
  // The async-iterator methods on FileSystemDirectoryHandle are in the spec
  // but not yet in lib.dom.d.ts (as of TS 5.7). Declare the one we use.
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }
}

export function FileUpload() {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const watchHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const watchSeenRef = useRef<Set<string>>(new Set());
  const watchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // Cleanup watch interval on unmount
  useEffect(() => {
    return () => {
      if (watchTimerRef.current) clearInterval(watchTimerRef.current);
    };
  }, []);

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

            router.push("/report");
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

  // Auto-detect via File System Access API. Chrome/Edge only; gracefully
  // surfaces a hint on other browsers.
  const handleAutoDetect = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      setState({
        status: "error",
        message:
          "Auto-detect needs the File System Access API (Chrome 86+ or Edge). On other browsers, drag your TikTok export onto the box above instead.",
      });
      return;
    }

    let dirHandle: FileSystemDirectoryHandle;
    try {
      dirHandle = await window.showDirectoryPicker({
        id: "creator-dna-downloads",
        mode: "read",
        startIn: "downloads",
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return; // user canceled
      setState({
        status: "error",
        message:
          err instanceof Error
            ? `Could not access folder: ${err.message}`
            : "Could not access folder.",
      });
      return;
    }

    watchHandleRef.current = dirHandle;
    watchSeenRef.current = new Set();
    setState({ status: "watching", folderName: dirHandle.name });

    // First scan + register existing files as already-seen so we only act
    // on NEW arrivals after this point. Exception: if a TikTok export is
    // already there, process it immediately.
    const found = await scanForTikTokExport(dirHandle, /* registerOnly */ false);
    if (found) return;

    // No match yet, mark everything as seen and start polling for new arrivals.
    for await (const entry of dirHandle.values()) {
      if (entry.kind === "file") watchSeenRef.current.add(entry.name);
    }

    if (watchTimerRef.current) clearInterval(watchTimerRef.current);
    watchTimerRef.current = setInterval(() => {
      if (!watchHandleRef.current) return;
      void scanForTikTokExport(watchHandleRef.current, false);
    }, 5000);
  }, []);

  // Scan a directory for a TikTok-shaped export and process the first match.
  // `registerOnly` when true means: don't process anything, just record names
  // as already-seen (used to debounce the polling loop).
  const scanForTikTokExport = useCallback(
    async (dirHandle: FileSystemDirectoryHandle, registerOnly: boolean) => {
      try {
        for await (const entry of dirHandle.values()) {
          if (entry.kind !== "file") continue;
          const name = entry.name;
          if (registerOnly) {
            watchSeenRef.current.add(name);
            continue;
          }
          if (watchSeenRef.current.has(name)) continue;
          if (!TIKTOK_EXPORT_PATTERN.test(name)) continue;

          // New TikTok-shaped file — process and stop watching.
          if (watchTimerRef.current) {
            clearInterval(watchTimerRef.current);
            watchTimerRef.current = null;
          }
          watchHandleRef.current = null;
          const file = await (entry as FileSystemFileHandle).getFile();
          await processFile(file);
          return true;
        }
      } catch (err) {
        // Folder permission revoked, etc.
        if (watchTimerRef.current) {
          clearInterval(watchTimerRef.current);
          watchTimerRef.current = null;
        }
        watchHandleRef.current = null;
        setState({
          status: "error",
          message:
            err instanceof Error
              ? `Lost folder access: ${err.message}`
              : "Lost folder access.",
        });
      }
      return false;
    },
    [processFile],
  );

  const stopWatching = useCallback(() => {
    if (watchTimerRef.current) {
      clearInterval(watchTimerRef.current);
      watchTimerRef.current = null;
    }
    watchHandleRef.current = null;
    watchSeenRef.current = new Set();
    setState({ status: "idle" });
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

  if (state.status === "watching") {
    return (
      <div className="border-2 border-dashed border-accent rounded-[16px] p-12 max-w-[500px] w-full mx-auto text-center">
        <div className="text-text-secondary mb-2">
          Watching{" "}
          <span className="text-accent font-medium">{state.folderName}</span>
          ...
        </div>
        <div className="text-[13px] text-text-faint mb-4">
          When your TikTok export lands here, we&rsquo;ll pick it up automatically.
          Nothing leaves your browser.
        </div>
        <button
          onClick={stopWatching}
          className="text-[12px] text-text-faint underline hover:text-accent"
        >
          stop watching
        </button>
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

      <div className="mt-3 text-center text-[13px] text-text-faint">
        or{" "}
        <button
          onClick={handleAutoDetect}
          className="text-accent underline hover:no-underline"
        >
          auto-watch your Downloads folder &rarr;
        </button>
        <span className="ml-1 text-text-faint">(Chrome &amp; Edge)</span>
      </div>

      {state.status === "error" && (
        <div className="mt-4 p-4 rounded-lg bg-[rgba(212,102,90,0.1)] border-l-[3px] border-destructive text-destructive text-sm">
          {state.message}
        </div>
      )}
    </div>
  );
}
