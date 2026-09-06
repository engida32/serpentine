import { reportCrash as reportCrashAnalytics, trackEvent } from "./analytics";
import { submitFeedback } from "../game/leaderboard";

/**
 * A crash is reported two ways at once: as a Vercel Analytics event (visible
 * in the dashboard) and as a row in the `feedback` table (which then lands in
 * the Slack group via the notify-slack edge function). Both paths are best
 * effort and must never crash the app.
 */
export function reportCrash(kind: "game" | "page", label: string, detail?: string, game?: string) {
  reportCrashAnalytics(kind, label, detail);
  void submitFeedback({
    kind: "crash",
    message: `${label}${detail ? `\n${detail}` : ""}`,
    game,
  }).catch(() => {});
}

export { trackEvent };