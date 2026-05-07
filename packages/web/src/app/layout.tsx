import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Creator DNA — Discover What You Should Create",
  description:
    "Upload your TikTok data export. AI analyzes your consumption patterns and reveals the creator you already are.",
  openGraph: {
    title: "Creator DNA",
    description: "You already know what to create. Your data proves it.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
