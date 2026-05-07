import { FileUpload } from "@/components/file-upload";
import { NanoGate } from "@/components/nano-status";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 relative">
      {/* Warm radial glow behind the hero */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(199, 146, 83, 0.06) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-[600px] w-full text-center">
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,6vw,3.5rem)] font-normal tracking-tight text-text-primary leading-[1.1] mb-3">
          You already know
          <br />
          what to create.
        </h1>
        <p className="font-[family-name:var(--font-display)] text-xl italic text-accent mb-3">
          Your data proves it.
        </p>
        <p className="text-text-secondary text-base max-w-[420px] mx-auto mb-10">
          Upload your TikTok data export. We&apos;ll show you the creator you
          already are.
        </p>

        <NanoGate>
          <FileUpload />
        </NanoGate>

        <div className="flex items-center justify-center gap-2 mt-6 text-[13px] text-text-faint">
          <span className="w-[6px] h-[6px] rounded-full bg-success" />
          Your data never leaves your browser.
          <Link href="/privacy" className="text-accent underline ml-1">
            See what we send&nbsp;&rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
