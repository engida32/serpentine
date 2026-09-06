import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "./game/audio";
import { GAMES, type GameDef } from "./games";
import { gamesPlayed, TROPHIES, totalPoints, trophiesForGame, trophyCount } from "./game/progress";
import { IconBtn } from "./ui/controls";
import { GameErrorBoundary } from "./ui/ErrorBoundary";
import { IconChevron, IconMinimize, IconExpand, IconSound, IconTrophy, IconChat, LogoMark } from "./ui/icons";
import { useFullscreen } from "./ui/fullscreen";
import { autoTvMode, installInput, isTypingTarget, routeBack, useGamepad } from "./ui/input";
import { installNativeBack, isNative } from "./platform/native";
import { trackEvent } from "./platform/analytics";
import { TrophyModal } from "./ui/TrophyModal";
import { FeedbackModal } from "./ui/FeedbackModal";

type GameId = GameDef["id"];

const HISTORY_TAG = "serpentine:game";

const ACCENT_HEX: Record<string, string> = {
  "text-lime": "#a3f55a",
  "text-gold": "#ffcf5c",
  "text-coral": "#ff6257",
  "text-mint": "#3ddc84",
};

export default function Arcade() {
  const [gameId, setGameId] = useState<GameId | null>(null);
  const [sel, setSel] = useState(0);
  const [trophyOpen, setTrophyOpen] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);
  const { isFs, toggle } = useFullscreen();
  const [muted, setMutedState] = useState(() => {
    try {
      return localStorage.getItem("serpentine.muted") === "1";
    } catch {
      return false;
    }
  });
  const tv = useMemo(() => autoTvMode() || isNative, []);

  const gameIdRef = useRef(gameId);
  gameIdRef.current = gameId;
  /** True while a popstate-triggered back is being dispatched. */
  const poppingRef = useRef(false);
  /** Set when a game exits during a popstate dispatch, so we don't re-arm the history entry. */
  const exitedInPopRef = useRef(false);
  /** Set when we call history.back() ourselves, so the resulting popstate is ignored. */
  const suppressPopRef = useRef(false);

  const active = gameId ? GAMES.find((g) => g.id === gameId) : undefined;

  useEffect(() => {
    sfx.muted = muted;
    try {
      localStorage.setItem("serpentine.muted", muted ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [muted]);

  /* one-time platform wiring: input layer, native back button, TV class */
  useEffect(() => {
    const stopInput = installInput();
    let stopNative = () => {};
    void installNativeBack().then((fn) => (stopNative = fn));
    document.documentElement.classList.toggle("tv", tv);
    return () => {
      stopInput();
      stopNative();
    };
  }, [tv]);

  const onMute = useCallback(() => setMutedState((v) => !v), []);

  /**
   * Leaving a game. In a browser the game entry was pushed onto history, so
   * consume it (unless the exit was itself caused by a Back navigation).
   */
  const exitGame = useCallback(() => {
    sfx.select();
    if (poppingRef.current) {
      exitedInPopRef.current = true;
      setGameId(null);
      return;
    }
    if (window.history.state?.tag === HISTORY_TAG) {
      suppressPopRef.current = true;
      window.history.back();
    }
    setGameId(null);
  }, []);

  const play = useCallback((id: GameId) => {
    sfx.unlock();
    sfx.select();
    trackEvent("game_start", { game: id });
    const idx = GAMES.findIndex((g) => g.id === id);
    if (idx >= 0) setSel(idx);
    if (window.history.state?.tag !== HISTORY_TAG) window.history.pushState({ tag: HISTORY_TAG, id }, "");
    setGameId(id);
  }, []);

  /* browser / Android TV Back button = history navigation */
  useEffect(() => {
    const onPop = () => {
      if (suppressPopRef.current) {
        suppressPopRef.current = false;
        return;
      }
      if (gameIdRef.current === null) return;
      poppingRef.current = true;
      exitedInPopRef.current = false;
      const handled = routeBack();
      poppingRef.current = false;
      if (!handled) {
        setGameId(null);
        return;
      }
      // Back was consumed inside the game (modal closed, returned to its menu):
      // re-arm the history entry so the next Back press reaches us again.
      if (!exitedInPopRef.current) window.history.pushState({ tag: HISTORY_TAG, id: gameIdRef.current }, "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* hub shortcuts (arrows/enter are handled by the shared focus layer) */
  useEffect(() => {
    if (gameId !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || e.defaultPrevented) return;
      if (trophyOpen) return;
      sfx.unlock();
      const lower = e.key.toLowerCase();
      if (lower === "m") return onMute();
      if (lower === "f") return toggle();
      if (lower === "t") {
        setTrophyOpen(true);
        return;
      }
      const n = parseInt(lower, 10);
      if (n >= 1 && n <= GAMES.length) {
        e.preventDefault();
        play(GAMES[n - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gameId, trophyOpen, onMute, toggle, play]);

  /* gamepad Start on the hub launches the highlighted game */
  useGamepad({
    onStart: () => {
      if (gameId === null && !trophyOpen) play(GAMES[sel % GAMES.length].id);
    },
  });

  return (
    <div
      className="h-full min-h-dvh flex flex-col overflow-hidden relative bg-ink text-foam"
      onPointerDown={() => sfx.unlock()}
    >
      {/* ambient layers */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 pixel-grid" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 42% at 50% -6%, rgba(61,220,132,0.13), transparent 70%), radial-gradient(ellipse 40% 30% at 100% 100%, rgba(255,207,92,0.06), transparent 70%), radial-gradient(ellipse 45% 35% at 0% 90%, rgba(255,98,87,0.05), transparent 70%), radial-gradient(ellipse 120% 100% at 50% 50%, transparent 55%, rgba(2,7,4,0.75) 100%)",
          }}
        />
        <div className="absolute left-0 right-0 h-24 bg-mint/[0.045] blur-md animate-scanband" />
      </div>

      {/* header */}
      <header className="relative z-10 flex items-center justify-between px-3 sm:px-6 tv:px-10 h-14 sm:h-16 tv:h-20 shrink-0 border-b border-line/60 bg-pit/60">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <LogoMark />
          <div className="leading-none min-w-0">
            <h1
              className="font-display text-[13px] sm:text-base tv:text-xl text-lime truncate"
              style={{ textShadow: "0 0 18px rgba(163,245,90,0.45), 2px 2px 0 rgba(15,122,77,0.9)" }}
            >
              SERPENTINE ARCADE
            </h1>
            <p className="text-[10px] sm:text-[11px] tv:text-sm text-fog tracking-[0.28em] mt-1 uppercase truncate">
              {active ? `${active.name} — ${active.tagline}` : `${GAMES.length} games · Works offline`}
            </p>
          </div>
        </div>
        {/* Header buttons are pointer-only; remotes use the M/F shortcuts and the game overlays. */}
        <div className="flex items-center gap-2" data-pointer-only>
          {!isNative && (
            <IconBtn title={isFs ? "Exit fullscreen (F)" : "Fullscreen (F)"} onClick={toggle} tabIndex={-1}>
              {isFs ? <IconMinimize /> : <IconExpand />}
            </IconBtn>
          )}
          <IconBtn title={muted ? "Unmute (M)" : "Mute (M)"} onClick={onMute} tabIndex={-1}>
            <IconSound muted={muted} />
          </IconBtn>
          <IconBtn title="Feedback / report an issue" onClick={() => setFbOpen(true)} tabIndex={-1}>
            <IconChat />
          </IconBtn>
        </div>
      </header>

      {active ? (
        <GameErrorBoundary resetKey={active.id} onHome={exitGame}>
          {active.render({ muted, onMute, onExit: exitGame, onFullscreen: toggle })}
        </GameErrorBoundary>
      ) : (
        <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center gap-5 sm:gap-6 tv:gap-8 px-4 py-6 overflow-y-auto">
          <div className="text-center">
            <p className="font-display text-[9px] tv:text-sm text-gold tracking-widest animate-blink">— INSERT COIN —</p>
            <h2
              className="font-display text-lg sm:text-2xl tv:text-4xl text-foam mt-3 tv:mt-5"
              style={{ textShadow: "0 0 24px rgba(61,220,132,0.35)" }}
            >
              SELECT A GAME
            </h2>
          </div>

          <div className="flex items-center justify-center gap-2 tv:gap-3 flex-wrap">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                sfx.select();
                setTrophyOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-line/60 bg-moss/40 px-2.5 py-1.5 text-gold hover:text-lime hover:border-lime/50 transition-colors cursor-pointer"
            >
              <IconTrophy className="w-3.5 h-3.5 tv:w-5 tv:h-5" />
              <span className="font-display text-[10px] tv:text-base tabular-nums">
                {trophyCount()}/{TROPHIES.length}
              </span>
              <span className="text-[8px] tv:text-xs font-display text-fog/70">TROPHIES</span>
              <span className="hidden tv:inline keycap ml-1">T</span>
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-line/60 bg-moss/30 px-2.5 py-1.5 text-foam">
              <span className="font-display text-[10px] tv:text-base tabular-nums">{gamesPlayed()}</span>
              <span className="text-[8px] tv:text-xs font-display text-fog/70">GAMES</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-line/60 bg-moss/30 px-2.5 py-1.5 text-foam">
              <span className="font-display text-[10px] tv:text-base tabular-nums">{totalPoints()}</span>
              <span className="text-[8px] tv:text-xs font-display text-fog/70">PTS</span>
            </span>
          </div>

          {/* The grid is a focus scope: D-pad / arrows move between cards, Enter / A launches. */}
          <div
            data-menu
            role="group"
            aria-label="Games"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 tv:grid-cols-4 gap-3 sm:gap-4 tv:gap-5 w-full max-w-[820px] tv:max-w-[1500px]"
          >
            {GAMES.map((g, i) => {
              const isActive = sel === i;
              const best = g.readBest?.() ?? 0;
              const achv = trophiesForGame(g.id);
              const hex = ACCENT_HEX[g.accent] ?? "#3ddc84";
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-label={`Play ${g.name}`}
                  data-autofocus={isActive || undefined}
                  onClick={() => play(g.id)}
                  onFocus={() => setSel(i)}
                  onMouseEnter={() => setSel(i)}
                  className={`game-card group relative rounded-lg border-2 bg-pit/85 p-5 sm:p-6 text-left transition-all duration-150 cursor-pointer
                    ${isActive ? "bg-moss/70" : "hover:bg-moss/40"}`}
                  style={{
                    borderColor: isActive ? hex : "rgba(39,148,104,0.5)",
                    boxShadow: isActive ? `0 0 26px ${hex}38` : undefined,
                    ["--card-accent" as string]: hex,
                  }}
                >
                  {isActive && <span className="absolute top-2.5 right-2.5 w-2 h-2 tv:w-3 tv:h-3 rounded-full bg-lime animate-blink" />}
                  <span className={`w-10 h-10 tv:w-14 tv:h-14 grid place-items-center rounded-md bg-moss border border-line mb-3 ${g.accent}`}>
                    {g.icon}
                  </span>
                  <span className="block">
                    <span className={`font-display text-[13px] tv:text-xl ${g.accent}`}>{g.name}</span>
                    <span className="block text-[11px] tv:text-lg text-fog mt-1.5 leading-relaxed">{g.tagline}</span>
                    {g.by && <span className="block text-[9px] tv:text-sm text-mint mt-1.5">made by @{g.by}</span>}
                    <span className="flex items-center justify-between mt-4">
                      <span className="inline-flex items-center gap-2 tv:gap-3">
                        {g.readBest ? (
                          <span className="inline-flex items-center gap-1.5 text-gold">
                            <span className="text-[8px] tv:text-xs font-display text-fog/70">BEST</span>
                            <span className="font-display text-[11px] tv:text-base tabular-nums">{best}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-gold">
                            <span className="text-[8px] tv:text-xs font-display text-fog/70">COIN-OP</span>
                            <span className="font-display text-[9px] tv:text-sm">FREE PLAY</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-gold/80">
                          <span className="text-[8px] tv:text-xs font-display text-fog/70">TOYS</span>
                          <span className="font-display text-[10px] tv:text-base tabular-nums">
                            {achv.unlocked.length}/{achv.total}
                          </span>
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 font-display text-[9px] tv:text-sm text-lime group-hover:gap-2 group-focus:gap-2 transition-all">
                        PLAY <IconChevron rotate={-90} />
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] tv:text-lg text-fog/75 text-center leading-relaxed max-w-[520px] tv:max-w-[900px] text-pretty">
            {tv ? (
              <>
                <span className="keycap">◀ ▲ ▼ ▶</span> pick a game · <span className="keycap">OK</span> play ·{" "}
                <span className="keycap">BACK</span> return · works offline, no account needed
              </>
            ) : (
              <>
                Arrows <span className="keycap">↑</span><span className="keycap">↓</span><span className="keycap">←</span>
                <span className="keycap">→</span> + <span className="keycap">1</span>–{GAMES.length.toString()} to pick ·{" "}
                <span className="keycap">ENTER</span> to play · works offline, with controllers, no account needed
              </>
            )}
          </p>
        </main>
      )}
      <TrophyModal open={trophyOpen} onClose={() => setTrophyOpen(false)} />
      <FeedbackModal open={fbOpen} onClose={() => setFbOpen(false)} />
    </div>
  );
}
