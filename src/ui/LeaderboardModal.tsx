import { useEffect, useState } from "react";
import {
  cleanName,
  fetchBoard,
  getPlayerName,
  lbEnabled,
  setPlayerName,
  submitScore,
  type BoardEntry,
} from "../game/leaderboard";
import { sfx } from "../game/audio";
import { IconTrophy } from "./icons";
import { ArcadeButton } from "./controls";

function rankBadge(i: number): string {
  if (i === 0) return "bg-gold text-ink";
  if (i === 1) return "bg-fog text-ink";
  if (i === 2) return "bg-coral text-ink";
  return "bg-moss text-fog";
}

export function LeaderboardModal({
  open,
  onClose,
  difficulty,
  label,
  labelColor = "#a3f55a",
  myScore = 0,
}: {
  open: boolean;
  onClose: () => void;
  difficulty: string;
  label?: string;
  labelColor?: string;
  myScore?: number;
}) {
  const [rows, setRows] = useState<BoardEntry[]>([]);
  const [name, setName] = useState(getPlayerName());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setLoading(true);
    let live = true;
    fetchBoard(difficulty).then((r) => {
      if (!live) return;
      setRows(r);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [open, difficulty, saved]);

  if (!open) return null;

  const canSave = myScore > 0 && !saved && !saving;

  const doSave = () => {
    if (!canSave) return;
    setSaving(true);
    sfx.select();
    const n = cleanName(name || getPlayerName());
    setPlayerName(n);
    setName(n);
    submitScore(n, difficulty, myScore).then(() => {
      setSaved(true);
      setSaving(false);
    });
  };

  const myKey = `${name}:${myScore}`;

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center p-3 sm:p-6 bg-[rgba(3,10,6,0.86)] animate-rise"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[400px] max-h-[90dvh] overflow-y-auto bg-pit/95 border border-line rounded-lg shadow-[0_26px_60px_rgba(0,0,0,0.6)] animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line/60">
          <div className="flex items-center gap-2">
            <span className="text-gold">
              <IconTrophy />
            </span>
            <h2 className="font-display text-[9px] text-foam tracking-wider">LEADERBOARD</h2>
            {label && (
              <span className="font-display text-[8px] tracking-wider" style={{ color: labelColor }}>
                {label}
              </span>
            )}
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

        <div className="p-4">
          {!lbEnabled && (
            <p className="text-[10px] text-fog/85 bg-moss/50 border border-line/70 rounded-md px-3 py-2 mb-3 leading-relaxed">
              Offline rankings — scores are kept on this device. Connect Supabase (see README) to enable a global board.
            </p>
          )}

          {loading ? (
            <p className="text-fog text-sm py-6 text-center animate-blink">LOADING…</p>
          ) : rows.length === 0 ? (
            <p className="text-fog text-sm py-6 text-center">No scores yet — be the first on the board.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {rows.map((r, i) => {
                const mine = r.name === name && r.score === myScore && myScore > 0;
                return (
                  <li
                    key={`${r.name}:${r.score}:${i}`}
                    className={`flex items-center gap-2.5 rounded-md border px-2.5 py-2 ${
                      mine ? "border-lime/70 bg-lime/10" : "border-line/60 bg-moss/30"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 shrink-0 grid place-items-center rounded-md font-display text-[9px] tabular-nums ${rankBadge(i)}`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-bold text-foam text-sm">{r.name}</span>
                    {r.remote && <span className="text-[8px] font-display text-mint tracking-wider">LIVE</span>}
                    {mine && <span className="text-[8px] font-display text-gold tracking-wider">YOU</span>}
                    <span className="font-display text-[10px] text-lime tabular-nums">{r.score}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {canSave && (
            <form
              className="mt-3 pt-3 border-t border-line/60 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                doSave();
              }}
            >
              <label className="font-display text-[8px] text-fog tracking-wider" htmlFor="lb-name">
                SAVE YOUR SCORE — {myScore}
              </label>
              <div className="flex gap-2">
                <input
                  id="lb-name"
                  value={name}
                  maxLength={12}
                  autoComplete="off"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="NAME"
                  className="flex-1 min-w-0 bg-ink/70 border border-line rounded-md px-3 py-2 text-foam font-bold text-sm focus:outline-none focus:border-lime placeholder:text-fog/50"
                />
                <ArcadeButton variant="primary" onClick={doSave} className="shrink-0">
                  Save
                </ArcadeButton>
              </div>
            </form>
          )}

          {saved && (
            <p className="mt-3 pt-3 border-t border-line/60 font-display text-[9px] text-lime tracking-wider text-center animate-pop">
              SCORE SAVED ✓
            </p>
          )}
        </div>
      </div>
    </div>
  );
}