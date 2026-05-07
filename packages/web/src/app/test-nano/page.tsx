"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  buildClusteringPrompt,
  buildQualificationPrompt,
  buildContentGapPrompt,
  type CreatorDNASummary,
  type Niche,
} from "@creator-dna/core";
import {
  nicheJsonSchema,
  qualificationJsonSchema,
  contentIdeasJsonSchema,
} from "@/lib/nano-schemas";

interface RunStep {
  label: string;
  promptText: string;
  rawResponse: string;
  parsed: unknown;
  parseError: string | null;
  ms: number;
}

type Status = "idle" | "loading-summary" | "running" | "done" | "error";

const SYSTEM_PROMPT =
  "You are a data analyst. Output a single JSON object that matches the provided schema. No commentary.";

interface LMSession {
  prompt(
    input: string,
    options?: { responseConstraint?: object },
  ): Promise<string>;
  destroy(): void;
}
interface LMOptions {
  systemPrompt?: string;
  temperature?: number;
  topK?: number;
  outputLanguage?: string;
}
declare const LanguageModel:
  | {
      availability(): Promise<string>;
      create(opts?: LMOptions): Promise<LMSession>;
    }
  | undefined;

export default function TestNanoPage() {
  const [summaryJson, setSummaryJson] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [temperature, setTemperature] = useState(0.3);
  const [topK, setTopK] = useState(5);
  const [availability, setAvailability] = useState<string>("?");

  // Pull a default summary from sample-report.json if the user hasn't pasted one.
  useEffect(() => {
    setStatus("loading-summary");
    fetch("/sample-report.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.summary) {
          setSummaryJson(JSON.stringify(data.summary, null, 2));
        }
        setStatus("idle");
      })
      .catch(() => setStatus("idle"));

    if (typeof LanguageModel !== "undefined") {
      LanguageModel.availability().then(setAvailability).catch(() => setAvailability("error"));
    } else {
      setAvailability("LanguageModel undefined");
    }
  }, []);

  const runOne = useCallback(
    async (
      label: string,
      promptText: string,
      schema: object,
    ): Promise<RunStep> => {
      const t0 = performance.now();

      if (typeof LanguageModel === "undefined") {
        throw new Error("LanguageModel API not available");
      }

      const session = await LanguageModel.create({
        systemPrompt: SYSTEM_PROMPT,
        temperature,
        topK,
        outputLanguage: "en",
      });
      try {
        const raw = await session.prompt(promptText, { responseConstraint: schema });
        const ms = performance.now() - t0;
        let parsed: unknown = null;
        let parseError: string | null = null;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          parseError = e instanceof Error ? e.message : String(e);
        }
        return { label, promptText, rawResponse: raw, parsed, parseError, ms };
      } finally {
        session.destroy();
      }
    },
    [temperature, topK],
  );

  const run = useCallback(async () => {
    setError(null);
    setSteps([]);
    setStatus("running");

    let summary: CreatorDNASummary;
    try {
      summary = JSON.parse(summaryJson) as CreatorDNASummary;
    } catch (e) {
      setError(`Couldn't parse summary JSON: ${e instanceof Error ? e.message : e}`);
      setStatus("error");
      return;
    }

    try {
      const niches = await runOne(
        "1. Clustering",
        buildClusteringPrompt(summary),
        nicheJsonSchema,
      );
      setSteps([niches]);

      const parsedNiches = (niches.parsed as { niches?: Niche[] } | null)?.niches;
      if (!parsedNiches || parsedNiches.length === 0) {
        setError("Step 1 didn't return parseable niches; skipping steps 2 & 3.");
        setStatus("error");
        return;
      }

      const [qual, ideas] = await Promise.all([
        runOne(
          "2. Qualification",
          buildQualificationPrompt(summary, parsedNiches),
          qualificationJsonSchema,
        ),
        runOne(
          "3. Content ideas",
          buildContentGapPrompt(summary, parsedNiches),
          contentIdeasJsonSchema,
        ),
      ]);
      setSteps([niches, qual, ideas]);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [summaryJson, runOne]);

  return (
    <main className="max-w-[1100px] mx-auto px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-text-faint hover:text-accent mb-6"
      >
        &larr; Back
      </Link>

      <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,4vw,2.5rem)] font-normal text-text-primary mb-2">
        Nano dev surface
      </h1>
      <p className="text-text-secondary text-sm mb-6">
        Bare interrogation of Chrome&rsquo;s on-device Gemini Nano with the
        Creator DNA prompts. Paste a summary or use the bundled sample, run the
        3-prompt pipeline, see raw output + parsed JSON + per-step timing.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
        <aside className="space-y-5 text-sm">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-2">
              LanguageModel availability
            </div>
            <div className="font-[family-name:var(--font-data)] text-text-primary">
              {availability}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-1">
              Temperature: {temperature.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-1">
              Top-K: {topK}
            </label>
            <input
              type="range"
              min="1"
              max="40"
              step="1"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>

          <button
            onClick={run}
            disabled={status === "running"}
            className="w-full px-4 py-2.5 rounded-lg bg-accent text-bg-base text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {status === "running" ? "Running..." : "Run all 3 prompts"}
          </button>

          {error && (
            <div className="text-[12px] text-destructive border-l-2 border-destructive pl-3">
              {error}
            </div>
          )}
        </aside>

        <section>
          <details className="mb-6 border border-border rounded-xl">
            <summary className="cursor-pointer px-4 py-3 text-sm text-text-secondary hover:text-text-primary">
              Input summary (paste or edit){" "}
              <span className="text-text-faint">
                ({summaryJson.length.toLocaleString()} chars)
              </span>
            </summary>
            <textarea
              value={summaryJson}
              onChange={(e) => setSummaryJson(e.target.value)}
              className="w-full h-[280px] p-3 bg-surface text-[11px] font-[family-name:var(--font-data)] text-text-muted border-t border-border outline-none"
              spellCheck={false}
            />
          </details>

          <div className="space-y-6">
            {steps.length === 0 && status !== "running" && (
              <div className="text-text-faint text-sm">
                Click <em>Run all 3 prompts</em> to start.
              </div>
            )}

            {steps.map((s) => (
              <StepView key={s.label} step={s} />
            ))}

            {status === "running" && steps.length < 3 && (
              <div className="text-text-faint text-sm animate-pulse">
                Step {steps.length + 1} of 3 in flight...
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StepView({ step }: { step: RunStep }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-surface flex items-center justify-between text-sm">
        <span className="text-text-primary font-medium">{step.label}</span>
        <span className="text-[11px] font-[family-name:var(--font-data)] text-text-faint">
          {Math.round(step.ms)}ms · {step.rawResponse.length}c
          {step.parseError && (
            <span className="text-destructive ml-2">parse-fail</span>
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
        <details>
          <summary className="cursor-pointer px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-accent">
            Prompt
          </summary>
          <pre className="px-4 py-3 text-[11px] font-[family-name:var(--font-data)] text-text-muted whitespace-pre-wrap overflow-x-auto max-h-[400px]">
            {step.promptText}
          </pre>
        </details>

        <details open>
          <summary className="cursor-pointer px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-accent">
            Raw → parsed
          </summary>
          <div className="px-4 py-3">
            <div className="text-[11px] text-text-faint mb-1">Raw response:</div>
            <pre className="text-[11px] font-[family-name:var(--font-data)] text-text-muted whitespace-pre-wrap overflow-x-auto max-h-[200px] mb-3">
              {step.rawResponse || "(empty)"}
            </pre>

            <div className="text-[11px] text-text-faint mb-1">
              Parsed JSON {step.parseError && <span className="text-destructive">— {step.parseError}</span>}:
            </div>
            <pre className="text-[11px] font-[family-name:var(--font-data)] text-text-primary whitespace-pre-wrap overflow-x-auto max-h-[400px]">
              {step.parsed ? JSON.stringify(step.parsed, null, 2) : "(none)"}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
}
