"use client";

import { useCallback, useRef, useState } from "react";
import type { NicheResponse, CreatorDNASummary } from "@creator-dna/core";

interface ShareCardProps {
  niches: NicheResponse;
  summary: CreatorDNASummary;
}

type CardFormat = "square" | "story";

function drawCard(
  canvas: HTMLCanvasElement,
  niches: NicheResponse,
  summary: CreatorDNASummary,
  format: CardFormat,
) {
  const isStory = format === "story";
  const w = 1080;
  const h = isStory ? 1920 : 1080;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, w, h);

  // Radial glow
  const gradient = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, w * 0.6);
  gradient.addColorStop(0, "rgba(199, 146, 83, 0.12)");
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Subtle border
  ctx.strokeStyle = "#2a2520";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, w - 80, h - 80);

  const cx = w / 2;
  const topNiche = niches.niches[0];
  const yStart = isStory ? h * 0.28 : h * 0.22;

  // "MY CREATOR DNA" label
  ctx.fillStyle = "#c79253";
  ctx.font = "500 28px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.letterSpacing = "6px";
  ctx.fillText("MY CREATOR DNA", cx, yStart);
  ctx.letterSpacing = "0px";

  // Top niche name
  ctx.fillStyle = "#f5ede3";
  ctx.font = "400 52px 'Instrument Serif', Georgia, serif";
  const nicheLines = wrapText(ctx, topNiche.name, w - 160);
  let y = yStart + 70;
  for (const line of nicheLines) {
    ctx.fillText(line, cx, y);
    y += 62;
  }

  // Confidence score (big number)
  y += 20;
  ctx.fillStyle = "#c79253";
  ctx.font = "300 120px 'JetBrains Mono', monospace";
  ctx.fillText(`${topNiche.confidence}`, cx, y + 100);

  // "confidence score" label
  ctx.fillStyle = "#6b6058";
  ctx.font = "400 24px 'JetBrains Mono', monospace";
  ctx.fillText("confidence score", cx, y + 145);

  // Stats line
  const statsY = isStory ? h * 0.72 : h * 0.78;
  ctx.fillStyle = "#4a4338";
  ctx.font = "400 22px 'DM Sans', sans-serif";
  ctx.fillText(
    `${summary.stats.videosWatched.toLocaleString()} videos · ${summary.stats.videosLiked.toLocaleString()} likes · ${summary.stats.searchesCount.toLocaleString()} searches`,
    cx,
    statsY,
  );

  // Other niches (smaller)
  if (niches.niches.length > 1) {
    const othersY = statsY + 50;
    ctx.fillStyle = "#6b6058";
    ctx.font = "400 20px 'DM Sans', sans-serif";
    const others = niches.niches
      .slice(1, 3)
      .map((n) => n.name)
      .join("  ·  ");
    ctx.fillText(others, cx, othersY);
  }

  // CTA at bottom
  ctx.fillStyle = "#c79253";
  ctx.font = "500 22px 'JetBrains Mono', monospace";
  ctx.letterSpacing = "3px";
  ctx.fillText("CREATORDNA.APP", cx, h - 70);
  ctx.letterSpacing = "0px";
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function ShareCard({ niches, summary }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generated, setGenerated] = useState(false);
  const [format, setFormat] = useState<CardFormat>("square");

  const generate = useCallback(
    (fmt: CardFormat) => {
      if (!canvasRef.current) return;
      setFormat(fmt);
      drawCard(canvasRef.current, niches, summary, fmt);
      setGenerated(true);
    },
    [niches, summary],
  );

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `creator-dna-${format}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }, [format]);

  return (
    <section id="share" className="py-16 border-t border-border-subtle">
      <div className="font-[family-name:var(--font-data)] text-[11px] font-medium uppercase tracking-[0.15em] text-accent mb-6">
        05 — Share Your DNA
      </div>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-normal text-text-primary mb-2">
        Show the world what you should be creating.
      </h2>
      <p className="text-sm text-text-muted mb-8">
        Download your Creator DNA card and post it on TikTok, Instagram, or Twitter.
      </p>

      {/* Format picker */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => generate("square")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            generated && format === "square"
              ? "bg-accent text-[#0a0a0a]"
              : "border border-border text-text-secondary hover:border-accent"
          }`}
        >
          Square (1080x1080)
        </button>
        <button
          onClick={() => generate("story")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            generated && format === "story"
              ? "bg-accent text-[#0a0a0a]"
              : "border border-border text-text-secondary hover:border-accent"
          }`}
        >
          Story (1080x1920)
        </button>
      </div>

      {/* Canvas preview */}
      <div className="flex justify-center mb-6">
        <canvas
          ref={canvasRef}
          className={`rounded-xl border border-border max-w-full ${
            generated
              ? format === "story"
                ? "max-h-[500px]"
                : "max-h-[360px]"
              : "hidden"
          }`}
          style={{ width: "auto", height: "auto" }}
        />
        {!generated && (
          <div
            className="w-[320px] aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-accent transition-colors"
            onClick={() => generate("square")}
          >
            <span className="text-text-muted text-sm">Click to generate your card</span>
          </div>
        )}
      </div>

      {/* Download + actions */}
      {generated && (
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={download}
            className="px-6 py-3 bg-accent text-[#0a0a0a] rounded-lg font-medium text-sm hover:brightness-110 transition"
          >
            Download Card
          </button>
        </div>
      )}
    </section>
  );
}
