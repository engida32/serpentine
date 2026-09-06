import { track } from "@vercel/analytics";

export type AnalyticsProps = Record<string, string | number | boolean | null>;

/** Custom events for Vercel Web Analytics. No-ops when analytics isn't enabled. */
export function trackEvent(name: string, data?: AnalyticsProps) {
  try {
    track(name, data);
  } catch {
    /* analytics must never take the game down */
  }
}

/** Best-effort crash telemetry: label + first 200 chars of the message. */
export function reportCrash(kind: "game" | "page", label: string, detail?: string) {
  trackEvent("app_crash", { kind, label, detail: detail?.slice(0, 200) ?? null });
}