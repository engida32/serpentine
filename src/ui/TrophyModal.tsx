import { useEffect, useRef } from "react";
import { TROPHIES, unlockedTrophies, trophyCount } from "../game/progress";
import { GAMES } from "../games";
import { sfx } from "../game/audio";
import { IconCheck, IconTrophy } from "./icons";
import { useBackHandler } from "./input";

export function TrophyModal({
  open,
  onClose,
  game,
}: {
  open: boolean;
  onClose: () => void;
  game?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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

  const have = new Set(unlockedTrophies());
  const games = game ? GAMES.filter((g) => g.id === game) : GAMES;

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center p-3 sm:p-6 bg-[rgba(3,10,6,0.86)] animate-rise"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Trophies"
        className="w-full max-w-[420px] max-h-[90dvh] overflow-y-auto bg-pit/95 border border-line rounded-lg shadow-[0_26px_60px_rgba(0,0,0,0.6)] animate-rise focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line/60">
          <div className="flex items-center gap-2">
            <span className="text-gold">
              <IconTrophy />
            </span>
            <h2 className="font-display text-[9px] tv:text-sm text-foam tracking-wider">TROPHIES</h2>
            <span className="font-display text-[8px] tv:text-xs text-lime tracking-wider">
              {trophyCount()}/{TROPHIES.length}
            </span>
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

        <div className="p-4 flex flex-col gap-4">
          {games.map((g) => {
            const locker = TROPHIES.filter((t) => t.game === g.id);
            if (locker.length === 0) return null;
            const got = locker.filter((t) => have.has(t.id)).length;
            return (
              <section key={g.id}>
                <p className="font-display text-[8px] tv:text-xs text-fog tracking-wider mb-2">
                  {g.name.toUpperCase()}{" "}
                  <span className="text-[9px] tv:text-sm text-lime normal-case tracking-normal">
                    {got}/{locker.length}
                  </span>
                </p>
                <ul className="flex flex-col gap-1.5">
                  {locker.map((t) => {
                    const unlocked = have.has(t.id);
                    return (
                      <li
                        key={t.id}
                        className={`flex items-start gap-2.5 rounded-md border px-2.5 py-2 ${
                          unlocked ? "border-lime/60 bg-lime/10" : "border-line/60 bg-moss/30 opacity-70"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 shrink-0 mt-0.5 grid place-items-center rounded-md border ${
                            unlocked ? "text-lime border-lime/50 bg-lime/15" : "text-fog/50 border-line/60"
                          }`}
                        >
                          {unlocked ? <IconCheck /> : <span className="font-display text-[9px] tv:text-sm">?</span>}
                        </span>
                        <span className="min-w-0">
                          <span className={`block font-bold text-[12px] ${unlocked ? "text-foam" : "text-fog"}`}>{t.name}</span>
                          <span className="block text-[10px] tv:text-base text-fog/80">{t.hint}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}