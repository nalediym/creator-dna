/**
 * Trigger Chrome's on-device model download from a user gesture.
 *
 * The Prompt API only fetches Gemini Nano lazily — calling `create()` is what
 * starts the download. The `monitor` callback wires up a `downloadprogress`
 * event so the UI can show a progress bar.
 *
 * The current spec emits `loaded` as a fraction in [0, 1]. Older drafts used
 * raw bytes. We normalise to a fraction so callers don't have to care.
 */

interface LanguageModelMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: { loaded: number; total?: number }) => void,
  ): void;
}

interface LanguageModelSession {
  destroy(): void;
}

declare const LanguageModel:
  | {
      create(options?: {
        monitor?: (m: LanguageModelMonitor) => void;
        outputLanguage?: string;
      }): Promise<LanguageModelSession>;
    }
  | undefined;

export interface NanoDownloadCallbacks {
  /** Fraction in [0, 1]. Called multiple times as Chrome streams the model. */
  onProgress: (fraction: number) => void;
  /** Called once when the model is fully resident and `availability()` would return "available". */
  onReady: () => void;
  /** Called if `create()` rejects (network failure, hardware ineligibility, etc.). */
  onError: (error: Error) => void;
}

/**
 * Start (or attach to) the on-device model download.
 *
 * Idempotent: if Chrome is already mid-download, this attaches a fresh
 * monitor and the same `downloadprogress` events fire.
 *
 * Must be called from a user gesture handler — Chrome blocks the download
 * otherwise.
 */
export async function startNanoDownload(
  cb: NanoDownloadCallbacks,
): Promise<void> {
  if (typeof LanguageModel === "undefined") {
    cb.onError(
      new Error(
        "Chrome's LanguageModel API isn't exposed. Enable chrome://flags/#prompt-api-for-gemini-nano and reload.",
      ),
    );
    return;
  }

  let session: LanguageModelSession | null = null;
  try {
    session = await LanguageModel.create({
      outputLanguage: "en",
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          cb.onProgress(normaliseProgress(e.loaded, e.total));
        });
      },
    });
    cb.onProgress(1);
    cb.onReady();
  } catch (err) {
    cb.onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    // Drop the throwaway session — analyzeLocally creates its own when the
    // user actually runs analysis.
    session?.destroy();
  }
}

function normaliseProgress(loaded: number, total?: number): number {
  if (loaded <= 1 && (total === undefined || total <= 1)) return loaded;
  if (total && total > 0) return Math.min(1, loaded / total);
  // Loaded looks like bytes but we have no total — best we can do is clamp
  // and report a heuristic fraction. Caller can show indeterminate UI.
  return 0;
}
