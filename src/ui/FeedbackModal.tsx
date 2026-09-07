import { useEffect, useRef, useState } from "react";
import { sfx } from "../game/audio";
import { lbEnabled, getPlayerName, setPlayerName, submitFeedback } from "../game/leaderboard";
import { trackEvent } from "../platform/telemetry";
import { IconChat, IconTrophy } from "./icons";
import { ArcadeButton } from "./controls";
import { useBackHandler } from "./input";

const COMMUNITY_URL =
  import.meta.env.VITE_COMMUNITY_URL ||
  "https://join.slack.com/t/serpentinearcade/shared_invite/zt-491vp4j6d-QpL_eE2eE5J_DbL5vqwG4A";

type Kind = "feedback" | "issue";

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<Kind>("feedback");
  const [name, setName] = useState(getPlayerName());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSent(false);
    setFailed(false);
    panelRef.current?.focus();
  }, [open]);

  useBackHandler(
    () => {
      onClose();
      return true;
    },
    open,
  );

  if (!open) return null;

  const canSend = lbEnabled && !sending && !sent && message.trim().length > 0;

  const doSend = () => {
    if (!canSend) return;
    setSending(true);
    setFailed(false);
    sfx.select();
    const n = name.trim().slice(0, 12);
    setPlayerName(n);
    submitFeedback({ kind, message: message.trim(), name: n }).then((ok) => {
      setSending(false);
      if (ok) {
        setSent(true);
        setMessage("");
        trackEvent("feedback_sent", { kind });
      } else {
        setFailed(true);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center p-3 sm:p-6 bg-[rgba(3,10,6,0.86)] animate-rise"
      onClick={() => {
        if (!sending) onClose();
      }}
    >
      <div
        ref={panelRef}
        data-menu
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Feedback"
        className="w-full max-w-[400px] max-h-[90dvh] overflow-y-auto bg-pit/95 border border-line rounded-lg shadow-[0_26px_60px_rgba(0,0,0,0.6)] animate-rise focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line/60">
          <div className="flex items-center gap-2">
            <span className="text-lime">
              <IconChat />
            </span>
            <h2 className="font-display text-[9px] tv:text-sm text-foam tracking-wider">SAY SOMETHING</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              sfx.click();
              onClose();
            }}
            className="w-8 h-8 grid place-items-center rounded-md bg-moss border border-line text-fog hover:text-lime cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="m3 3 10 10M13 3 3 13" />
            </svg>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-1">
            {(["feedback", "issue"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  sfx.click();
                  setKind(k);
                }}
                className={`px-2.5 py-1 rounded-md font-display text-[8px] tv:text-xs tracking-wider border transition-colors ${
                  kind === k ? "bg-moss text-lime border-lime/60" : "text-fog border-line/60 hover:text-foam"
                }`}
              >
                {k === "feedback" ? "FEEDBACK" : "REPORT A BUG"}
              </button>
            ))}
          </div>

          {!lbEnabled && (
            <p className="text-[10px] tv:text-base text-fog/85 bg-moss/50 border border-line/70 rounded-md px-3 py-2 leading-relaxed">
              Feedback is offline — connect Supabase (see README) and the Ark will mail your words to the crew.
            </p>
          )}

          <label className="flex flex-col gap-1">
            <span className="font-display text-[8px] tv:text-xs text-fog tracking-wider">YOUR NAME (OPTIONAL)</span>
            <input
              value={name}
              maxLength={12}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
              placeholder="NAME"
              className="bg-ink/70 border border-line rounded-md px-3 py-2 text-foam font-bold text-sm focus:outline-none focus:border-lime placeholder:text-fog/50"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-display text-[8px] tv:text-xs text-fog tracking-wider">MESSAGE</span>
            <textarea
              value={message}
              maxLength={4000}
              rows={4}
              onChange={(e) => {
                setMessage(e.target.value);
                if (failed) setFailed(false);
              }}
              placeholder={
                kind === "feedback"
                  ? "What did you like, or what would make the arcade better?"
                  : "What went wrong? Which game, and what did you do?"
              }
              className="bg-ink/70 border border-line rounded-md px-3 py-2 text-foam text-sm resize-none focus:outline-none focus:border-lime placeholder:text-fog/50"
            />
          </label>

          <ArcadeButton
            variant="primary"
            data-autofocus
            disabled={!canSend}
            onClick={doSend}
            className="justify-center"
          >
            {sending ? "Sending…" : "Send to the Ark"}
          </ArcadeButton>

          {sent && (
            <p className="font-display text-[9px] tv:text-sm text-lime tracking-wider text-center animate-pop">
              SENT — THANKS! ✓
            </p>
          )}
          {failed && (
            <p className="font-display text-[8px] tv:text-xs text-coral tracking-wider text-center">
              COULDN'T REACH THE ARK — TRY AGAIN IN A MOMENT
            </p>
          )}

          <a
            href={COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center justify-center gap-2 rounded-md py-2 font-display text-[8px] tv:text-xs tracking-wider text-fog/80 border border-dashed border-line/70 hover:text-lime hover:border-lime/50 transition-colors"
          >
            <IconTrophy />
            SEE ERRORY, SHARE SCORES & TALK TACTICS IN THE SLACK
          </a>
        </div>
      </div>
    </div>
  );
}