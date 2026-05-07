/**
 * Diagnose why Chrome's on-device Gemini Nano isn't usable.
 *
 * Returns a discriminated union so each UI branch can show the *exact* CTA
 * for the cause — wrong browser, outdated, flag off, just needs download,
 * hardware doesn't qualify, etc.
 */

const MIN_CHROME_MAJOR = 138;

export type Browser =
  | { kind: "chrome"; major: number }
  | { kind: "edge"; major: number }
  | { kind: "safari" }
  | { kind: "firefox" }
  | { kind: "other"; ua: string };

export interface DeviceCapability {
  /** GB of RAM as exposed by navigator.deviceMemory (Chromium-only, capped at 8). */
  deviceMemoryGb: number | null;
  /** navigator.hardwareConcurrency. */
  cores: number | null;
  /** Free disk-quota bytes from navigator.storage.estimate(). Coarse, but a useful floor. */
  storageQuotaBytes: number | null;
  storageUsageBytes: number | null;
  isMobile: boolean;
  isSecureContext: boolean;
}

/**
 * Reason the on-device model isn't ready.
 *
 * - `wrong-browser`     — not Chrome/Edge desktop
 * - `mobile`            — mobile UA, Nano isn't shipping on mobile
 * - `outdated-chrome`   — Chromium present but below MIN_CHROME_MAJOR
 * - `insecure-context`  — page isn't HTTPS (or localhost), API requires secure context
 * - `api-missing`       — supported browser but `LanguageModel` global isn't exposed
 *                         (origin trial not registered + flag off)
 * - `downloadable`      — model isn't on disk yet, but Chrome can fetch it
 * - `downloading`       — fetch in progress
 * - `hardware-fail`     — `availability() === "unavailable"` despite supported browser;
 *                         most often Chrome's hardware floor (~22 GB free disk, ~4 GB GPU/RAM)
 * - `available`         — ready
 */
export type DiagnoseStatus =
  | { status: "available"; browser: Browser; device: DeviceCapability }
  | { status: "downloadable"; browser: Browser; device: DeviceCapability }
  | { status: "downloading"; browser: Browser; device: DeviceCapability }
  | { status: "wrong-browser"; browser: Browser; device: DeviceCapability }
  | { status: "mobile"; browser: Browser; device: DeviceCapability }
  | {
      status: "outdated-chrome";
      browser: Browser;
      device: DeviceCapability;
      minRequired: number;
    }
  | { status: "insecure-context"; browser: Browser; device: DeviceCapability }
  | { status: "api-missing"; browser: Browser; device: DeviceCapability }
  | { status: "hardware-fail"; browser: Browser; device: DeviceCapability };

interface UserAgentDataBrand {
  brand: string;
  version: string;
}
interface UserAgentDataLike {
  mobile?: boolean;
  brands?: UserAgentDataBrand[];
}
interface NavigatorWithExtras extends Navigator {
  userAgentData?: UserAgentDataLike;
  deviceMemory?: number;
}

declare const LanguageModel:
  | {
      availability(): Promise<
        "available" | "downloading" | "downloadable" | "unavailable"
      >;
    }
  | undefined;

function detectBrowser(): Browser {
  if (typeof navigator === "undefined") return { kind: "other", ua: "" };
  const nav = navigator as NavigatorWithExtras;
  const ua = nav.userAgent ?? "";

  // Prefer UA-Client-Hints when available (Chromium 90+).
  const brands = nav.userAgentData?.brands ?? [];
  const edgeBrand = brands.find((b) => /edge/i.test(b.brand));
  if (edgeBrand) {
    return { kind: "edge", major: parseInt(edgeBrand.version, 10) || 0 };
  }
  const chromeBrand = brands.find(
    (b) => /chrome/i.test(b.brand) || /chromium/i.test(b.brand),
  );
  if (chromeBrand) {
    return { kind: "chrome", major: parseInt(chromeBrand.version, 10) || 0 };
  }

  // Fall back to UA string parsing.
  const edgeMatch = ua.match(/Edg\/(\d+)/);
  if (edgeMatch) return { kind: "edge", major: parseInt(edgeMatch[1], 10) };

  // Note: order matters — UA strings of Edge contain "Chrome" too.
  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  if (chromeMatch) return { kind: "chrome", major: parseInt(chromeMatch[1], 10) };

  if (/Firefox\//.test(ua)) return { kind: "firefox" };
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return { kind: "safari" };

  return { kind: "other", ua };
}

async function detectDevice(): Promise<DeviceCapability> {
  const nav =
    typeof navigator === "undefined"
      ? null
      : (navigator as NavigatorWithExtras);

  let storageQuotaBytes: number | null = null;
  let storageUsageBytes: number | null = null;
  if (nav?.storage?.estimate) {
    try {
      const est = await nav.storage.estimate();
      storageQuotaBytes = est.quota ?? null;
      storageUsageBytes = est.usage ?? null;
    } catch {
      // ignored
    }
  }

  return {
    deviceMemoryGb: nav?.deviceMemory ?? null,
    cores: nav?.hardwareConcurrency ?? null,
    storageQuotaBytes,
    storageUsageBytes,
    isMobile: nav?.userAgentData?.mobile ?? /Mobi|Android/i.test(nav?.userAgent ?? ""),
    isSecureContext: typeof window !== "undefined" ? window.isSecureContext : false,
  };
}

export async function diagnoseLocalAI(): Promise<DiagnoseStatus> {
  const browser = detectBrowser();
  const device = await detectDevice();

  if (device.isMobile) return { status: "mobile", browser, device };

  if (browser.kind === "safari" || browser.kind === "firefox" || browser.kind === "other") {
    return { status: "wrong-browser", browser, device };
  }

  if (browser.major > 0 && browser.major < MIN_CHROME_MAJOR) {
    return {
      status: "outdated-chrome",
      browser,
      device,
      minRequired: MIN_CHROME_MAJOR,
    };
  }

  if (!device.isSecureContext) {
    return { status: "insecure-context", browser, device };
  }

  if (typeof LanguageModel === "undefined") {
    return { status: "api-missing", browser, device };
  }

  try {
    const status = await LanguageModel.availability();
    if (status === "available") return { status: "available", browser, device };
    if (status === "downloadable") return { status: "downloadable", browser, device };
    if (status === "downloading") return { status: "downloading", browser, device };
    return { status: "hardware-fail", browser, device };
  } catch {
    return { status: "hardware-fail", browser, device };
  }
}

export function browserLabel(b: Browser): string {
  switch (b.kind) {
    case "chrome":
      return `Chrome ${b.major || "?"}`;
    case "edge":
      return `Edge ${b.major || "?"}`;
    case "safari":
      return "Safari";
    case "firefox":
      return "Firefox";
    case "other":
      return "Unknown browser";
  }
}

export function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}
