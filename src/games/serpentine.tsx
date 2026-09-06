import { useEffect, useRef, useState } from "react";
import { burst } from "../ui/confetti";
import {
  DIFFICULTIES,
  SnakeEngine,
  type DifficultyId,
  type DirName,
  type HudState,
} from "../game/engine";
import { sfx } from "../game/audio";
import { recordPlay, unlockTrophy } from "../game/progress";
import { ArcadeButton, DPad, IconBtn, Stat } from "../ui/controls";
import {
  IconChevron,
  IconCrown,
  IconHome,
  IconPause,
  IconPlay,
  IconRestart,
  IconSnake,
  IconSound,
  IconTrophy,
} from "../ui/icons";
import { isTypingTarget, useGamepad, useShellBack } from "../ui/input";
import { LeaderboardModal } from "../ui/LeaderboardModal";
import { ShareButton } from "../ui/ShareButton";
import type { SharePayload } from "../game/share";
import type { GameDef } from "./types";

const INITIAL_HUD: HudState = {
  phase: "menu",
  score: 0,
  best: 0,
  length: 4,
  speed: 1,
  foods: 0,
  newBest: false,
  difficulty: "arcade",
  win: false,
};

function readBest(id: DifficultyId): number {
  try {
    return Number(localStorage.getItem(`serpentine.best.${id}`) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function SnakeGame({
  muted,
  onMute,
  onExit,
  toggleFullscreen,
}: {
  muted: boolean;
  onMute: () => void;
  onExit: () => void;
  toggleFullscreen: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SnakeEngine | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [boardSize, setBoardSize] = useState(320);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbScore, setLbScore] = useState(0);
  const [isCoarse] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
  );

  const eng = () => engineRef.current;

  useShellBack({
    phase: hud.phase,
    pausePhases: ["playing"],
    enterPause: () => eng()?.togglePause(),
    lbOpen,
    closeLb: () => setLbOpen(false),
    onExit,
  });

  /* engine + sizing */
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const eng2 = new SnakeEngine(canvas, setHud);
    engineRef.current = eng2;
    const ro = new ResizeObserver(() => {
      const r = container.getBoundingClientRect();
      const s = Math.max(240, Math.floor(Math.min(r.width, r.height)));
      setBoardSize(s);
      eng2.resize(s, s, window.devicePixelRatio || 1);
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      eng2.destroy();
      engineRef.current = null;
    };
  }, []);

  /* keyboard + auto pause */
  useEffect(() => {
    const dirMap: Record<string, DirName> = {
      arrowup: "up", w: "up",
      arrowdown: "down", s: "down",
      arrowleft: "left", a: "left",
      arrowright: "right", d: "right",
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      const e2 = eng();
      if (!e2) return;
      sfx.unlock();
      const lower = e.key.toLowerCase();
      if (dirMap[lower]) {
        e.preventDefault();
        e2.setDirection(dirMap[lower]);
        return;
      }
      const ph = e2.getPhase();
      if (e.key === " ") {
        e.preventDefault();
        if (ph === "menu" || ph === "over") e2.start();
        else e2.togglePause();
        return;
      }
      if (e.key === "Enter") {
        if (ph === "menu" || ph === "over") e2.start();
        else if (ph === "paused") e2.togglePause();
        return;
      }
      if (lower === "p") return e2.togglePause();
      if (lower === "r") return ph !== "menu" ? e2.restart() : undefined;
      if (lower === "m") {
        onMute();
        return;
      }
      if (lower === "f") {
        toggleFullscreen();
        return;
      }
      if (lower === "l") {
        setLbScore(hud.score);
        setLbOpen(true);
        return;
      }
      if (e.key === "Escape" || lower === "goback" || e.keyCode === 461 || e.keyCode === 10009) {
        if (ph !== "menu") e2.toMenu();
        else onExit();
        return;
      }
      if (ph === "menu" && ["1", "2", "3"].includes(e.key)) {
        e2.setDifficulty(DIFFICULTIES[Number(e.key) - 1].id);
        sfx.select();
      }
    };
    const onVis = () => {
      if (document.hidden) eng()?.pauseIfPlaying();
    };
    const onBlur = () => eng()?.pauseIfPlaying();
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, [muted, onMute, toggleFullscreen, onExit, hud.score]);

  /* gamepad */
  useGamepad({
    onDir: (d) => eng()?.setDirection(d),
    onPrimary: () => {
      const ph = eng()?.getPhase();
      if (ph === "menu" || ph === "over") eng()?.start();
      else if (ph === "paused") eng()?.togglePause();
    },
    onSecondary: () => eng()?.togglePause(),
    onStart: () => {
      const ph = eng()?.getPhase();
      if (ph === "playing") eng()?.togglePause();
      else if (ph === "menu" || ph === "over") eng()?.start();
    },
    onBack: () => {
      if (eng()?.getPhase() !== "menu") eng()?.toMenu();
      else onExit();
    },
  });

  /* confetti on a cleared board */
  useEffect(() => {
    if (hud.win && hud.phase === "over") {
      const bursts = (n: number) => {
        if (n <= 0) return;
        burst({
          particleCount: 70,
          spread: 75,
          origin: { x: 0.5, y: 0.6 },
          colors: ["#a3f55a", "#3ddc84", "#ffcf5c", "#c8ff70", "#ffffff"],
          zIndex: 200,
        });
        setTimeout(() => bursts(n - 1), 450);
      };
      bursts(3);
    }
  }, [hud.win, hud.phase]);

  /* trophies + session stats */
  useEffect(() => {
    if (hud.phase !== "over") return;
    recordPlay(hud.score);
    let fresh = false;
    if (hud.win) fresh = unlockTrophy("snake.board") || fresh;
    if (hud.score >= 500) fresh = unlockTrophy("snake.500") || fresh;
    if (hud.foods >= 15) fresh = unlockTrophy("snake.feast") || fresh;
    if (fresh) sfx.record();
  }, [hud.phase, hud.score, hud.win, hud.foods]);

  /* touch: swipe on the board */
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchRef.current;
    touchRef.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    const e2 = eng();
    if (!e2) return;
    if (Math.abs(dx) > Math.abs(dy)) e2.setDirection(dx > 0 ? "right" : "left");
    else e2.setDirection(dy > 0 ? "down" : "up");
  };

  const inRun = hud.phase === "playing" || hud.phase === "ready" || hud.phase === "paused";
  const diffDef = DIFFICULTIES.find((d) => d.id === hud.difficulty) ?? DIFFICULTIES[1];

  const sharePayload: SharePayload = {
    game: "SERPENTINE",
    mode: diffDef.label,
    score: hud.score,
    extra: hud.win ? "board cleared" : undefined,
  };

  const openBoard = (score: number) => {
    setLbScore(score);
    setLbOpen(true);
  };

  return (
    <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center w-full max-w-[920px] mx-auto px-2 sm:px-4 gap-2 sm:gap-3 pt-2 sm:pt-3">
      {/* HUD */}
      <div
        className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 transition-[width] duration-150 ease-out shrink-0"
        style={{ width: Math.max(boardSize, 280) }}
      >
        <Stat label="SCORE">
          <span key={hud.score} className="inline-block animate-pop text-lime">{hud.score}</span>
        </Stat>
        <Stat label="BEST" accent="text-gold">
          <span className="inline-flex items-center gap-1.5">
            {hud.newBest && <span className="text-gold animate-wiggle inline-block"><IconCrown className="w-3.5 h-3.5" /></span>}
            {hud.best}
          </span>
        </Stat>
        <div
          className="flex items-center gap-2 bg-pit/90 border rounded-md px-3 py-2"
          style={{ borderColor: diffDef.color + "66" }}
        >
          <span className="font-display text-[8px] tv:text-xs tracking-wider" style={{ color: diffDef.color }}>
            {diffDef.label}
          </span>
          <span className="font-display text-sm text-foam tabular-nums">×{hud.speed.toFixed(2)}</span>
        </div>
        <Stat label="LEN" accent="text-mint">{hud.length}</Stat>
        <div className="flex items-center gap-1.5">
          <IconBtn
            title={hud.phase === "paused" ? "Resume (P)" : "Pause (P)"}
            disabled={!inRun && hud.phase !== "paused"}
            onClick={() => eng()?.togglePause()}
          >
            {hud.phase === "paused" ? <IconPlay /> : <IconPause />}
          </IconBtn>
          <IconBtn title="Restart (R)" disabled={hud.phase === "menu"} onClick={() => eng()?.restart()}>
            <IconRestart />
          </IconBtn>
        </div>
      </div>

      {/* board area */}
      <div ref={containerRef} className="flex-1 min-h-0 w-full flex items-center justify-center">
        <div
          className="relative rounded-[10px] border-2 border-line bg-pit overflow-hidden select-none
            shadow-[0_0_70px_rgba(61,220,132,0.12),0_26px_60px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(6,17,12,0.9)]"
          style={{ width: boardSize, height: boardSize, touchAction: "none" }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
          <div className="absolute inset-0 crt-lines pointer-events-none z-10 opacity-70" />
          <div className="absolute inset-0 board-vignette pointer-events-none z-10" />
          {["top-1.5 left-1.5", "top-1.5 right-1.5", "bottom-1.5 left-1.5", "bottom-1.5 right-1.5"].map((p) => (
            <span key={p} className={`absolute ${p} w-1.5 h-1.5 rounded-full bg-fern border border-line/70 z-10 pointer-events-none`} />
          ))}

          {/* READY overlay */}
          {hud.phase === "ready" && (
            <div className="absolute inset-0 z-20 grid place-items-center pointer-events-none">
              <div className="text-center animate-gopulse">
                <p className="font-display text-xl sm:text-2xl text-lime" style={{ textShadow: "0 0 24px rgba(163,245,90,0.6)" }}>
                  READY
                </p>
                <p className="text-fog text-xs tv:text-lg mt-2 tracking-[0.3em] uppercase">get set…</p>
              </div>
            </div>
          )}

          {/* PAUSE overlay */}
          {hud.phase === "paused" && (
            <div data-menu className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 sm:gap-5 bg-[rgba(3,10,6,0.86)] animate-rise p-4">
              <p className="font-display text-lg sm:text-xl text-mint" style={{ textShadow: "0 0 20px rgba(61,220,132,0.5)" }}>
                PAUSED
              </p>
              <p className="text-fog text-sm tv:text-xl -mt-2">The serpent waits in the grass…</p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <ArcadeButton variant="primary" data-autofocus onClick={() => eng()?.togglePause()}>
                  <IconPlay /> Resume
                </ArcadeButton>
                <ArcadeButton onClick={() => eng()?.restart()}>
                  <IconRestart /> Restart
                </ArcadeButton>
                <ArcadeButton onClick={() => eng()?.toMenu()}>
                  <IconHome /> Quit
                </ArcadeButton>
              </div>
              <p className="text-[11px] tv:text-lg text-fog/80 flex items-center gap-1.5">
                <span className="keycap">P</span> to resume
              </p>
            </div>
          )}

          {/* MENU overlay */}
          {hud.phase === "menu" && (
            <div data-menu className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.88)] animate-rise p-4 overflow-y-auto">
              <p className="font-display text-[9px] tv:text-sm text-gold tracking-widest animate-blink">— INSERT COIN —</p>
              <div className="w-full max-w-[300px]">
                <p className="font-display text-[9px] tv:text-sm text-fog text-center mb-2 tracking-wider">SELECT DIFFICULTY</p>
                <div className="flex flex-col gap-1.5">
                  {DIFFICULTIES.map((d, i) => {
                    const active = hud.difficulty === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          sfx.unlock();
                          sfx.select();
                          eng()?.setDifficulty(d.id);
                        }}
                        className={`w-full text-left rounded-md border px-3 py-2.5 flex items-center gap-3 transition-all duration-100 cursor-pointer
                          active:translate-y-[2px] ${active ? "bg-moss" : "bg-pit/70 hover:bg-moss/60 border-line/70"}`}
                        style={active ? { borderColor: d.color, boxShadow: `0 0 18px ${d.color}33` } : undefined}
                      >
                        <span
                          className="w-3 h-3 rounded-full border-2 shrink-0 grid place-items-center"
                          style={{ borderColor: d.color }}
                        >
                          {active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="font-display text-[10px] tv:text-base" style={{ color: d.color }}>
                              {d.label}
                            </span>
                            <span className="hidden sm:inline text-[9px] tv:text-sm text-fog/70 font-bold">{i + 1}</span>
                            <span className="flex gap-[3px] ml-auto sm:ml-0">
                              {[0, 1, 2].map((p) => (
                                <span
                                  key={p}
                                  className="w-1.5 h-3 rounded-[2px]"
                                  style={{ background: p < d.pips ? d.color : "rgba(39,92,65,0.55)" }}
                                />
                              ))}
                            </span>
                          </span>
                          <span className="block text-[11px] tv:text-lg text-fog truncate mt-0.5">{d.tagline}</span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-[8px] tv:text-xs font-display text-fog/70">BEST</span>
                          <span className="block font-display text-[10px] tv:text-base text-gold tabular-nums">
                            {active ? hud.best : readBest(d.id)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <ArcadeButton variant="primary" data-autofocus big onClick={() => eng()?.start()}>
                <IconPlay /> Start Run
              </ArcadeButton>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <ArcadeButton onClick={() => openBoard(0)}>
                  <IconTrophy /> Leaderboard
                </ArcadeButton>
                <ShareButton payload={{ game: "SERPENTINE", mode: DIFFICULTIES[1].label, score: hud.best }} />
              </div>
              <p className="text-[11px] tv:text-lg text-fog/85 text-center leading-relaxed">
                {isCoarse ? (
                  <>Swipe the board or use the pad to steer · gamepad ready</>
                ) : (
                  <span className="flex items-center justify-center gap-1.5 flex-wrap">
                    <span className="keycap">SPACE</span> start · <span className="keycap">↑↓←→</span> steer ·{" "}
                    <span className="keycap">GAMEPAD</span> works
                  </span>
                )}
              </p>
            </div>
          )}

          {/* GAME OVER overlay */}
          {hud.phase === "over" && (
            <div data-menu className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.88)] animate-rise p-4 overflow-y-auto">
              <p
                className={`font-display text-lg sm:text-2xl ${hud.win ? "text-gold" : "text-coral"}`}
                style={{ textShadow: hud.win ? "0 0 26px rgba(255,207,92,0.55)" : "0 0 26px rgba(255,98,87,0.5)" }}
              >
                {hud.win ? "BOARD CLEARED" : "GAME OVER"}
              </p>
              {hud.newBest ? (
                <div className="flex items-center gap-2 bg-gold/15 border border-gold/60 rounded-md px-3 py-1.5 animate-crown">
                  <span className="text-gold"><IconCrown /></span>
                  <span className="font-display text-[9px] tv:text-sm text-gold tracking-wider animate-blink">NEW HIGH SCORE</span>
                </div>
              ) : (
                <p className="text-fog text-sm tv:text-xl -mt-1">
                  {hud.foods >= 15 ? "So close — the apple was right there." : "The garden claims another serpent."}
                </p>
              )}
              <div className="text-center">
                <p className="font-display text-[8px] tv:text-xs text-fog tracking-widest mb-1.5">SCORE</p>
                <p className="font-display text-3xl sm:text-4xl text-lime animate-pop" key={hud.score} style={{ textShadow: "0 0 30px rgba(163,245,90,0.4)" }}>
                  {hud.score}
                </p>
              </div>
              <div className="flex items-center gap-2 text-center">
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] tv:text-xs font-display text-fog mb-1">BEST</p>
                  <p className="font-display text-xs text-gold tabular-nums">{hud.best}</p>
                </div>
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] tv:text-xs font-display text-fog mb-1">LENGTH</p>
                  <p className="font-display text-xs text-mint tabular-nums">{hud.length}</p>
                </div>
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] tv:text-xs font-display text-fog mb-1">APPLES</p>
                  <p className="font-display text-xs text-coral tabular-nums">{hud.foods}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <ArcadeButton variant="primary" data-autofocus big onClick={() => eng()?.start()}>
                  <IconRestart /> Play Again
                </ArcadeButton>
                <ArcadeButton onClick={() => eng()?.toMenu()}>
                  <IconHome /> Menu
                </ArcadeButton>
                <ArcadeButton onClick={() => openBoard(hud.score)}>
                  <IconTrophy /> Save Score
                </ArcadeButton>
              </div>
              <ShareButton payload={sharePayload} />
              {!isCoarse && (
                <p className="text-[11px] tv:text-lg text-fog/80 flex items-center gap-1.5">
                  <span className="keycap">SPACE</span> retry · <span className="keycap">ESC</span> menu
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* controls row */}
      {isCoarse ? (
        <div className="shrink-0 pb-2 flex items-center justify-center gap-8">
          <div className="grid grid-cols-3 gap-1.5">
            <span />
            <DPad onPress={() => eng()?.setDirection("up")} label="Up"><IconChevron rotate={0} /></DPad>
            <span />
            <DPad onPress={() => eng()?.setDirection("left")} label="Left"><IconChevron rotate={-90} /></DPad>
            <DPad
              center
              onPress={() => {
                const ph = eng()?.getPhase();
                if (ph === "menu" || ph === "over") eng()?.start();
                else eng()?.togglePause();
              }}
              label="Play or pause"
            >
              {hud.phase === "playing" || hud.phase === "ready" ? <IconPause /> : <IconPlay />}
            </DPad>
            <DPad onPress={() => eng()?.setDirection("right")} label="Right"><IconChevron rotate={90} /></DPad>
            <span />
            <DPad onPress={() => eng()?.setDirection("down")} label="Down"><IconChevron rotate={180} /></DPad>
            <span />
          </div>
          <div className="flex flex-col gap-1.5">
            <DPad wide onPress={() => eng()?.restart()} label="Restart" disabled={hud.phase === "menu"}>
              <IconRestart />
            </DPad>
            <DPad wide onPress={onMute} label="Toggle sound">
              <IconSound muted={muted} />
            </DPad>
          </div>
        </div>
      ) : (
        <div className="shrink-0 pb-2 sm:pb-3 text-center">
          <p className="text-[11px] tv:text-lg text-fog/85 flex items-center justify-center gap-x-2 gap-y-1 flex-wrap">
            <span className="keycap">↑</span><span className="keycap">↓</span><span className="keycap">←</span><span className="keycap">→</span>
            <span className="text-fog/60">or</span>
            <span className="keycap">WASD</span> steer
            <span className="text-line">·</span>
            <span className="keycap">SPACE</span> pause
            <span className="text-line">·</span>
            <span className="keycap">R</span> restart
            <span className="text-line">·</span>
            <span className="keycap">M</span> sound
            <span className="text-line">·</span>
            <span className="keycap">F</span> fullscreen
          </p>
          <p className="font-display text-[7px] tv:text-[11px] text-fog/50 tracking-[0.3em] mt-1.5 uppercase">
            Eat · Grow · Survive
          </p>
        </div>
      )}

      <LeaderboardModal
        open={lbOpen}
        onClose={() => setLbOpen(false)}
        difficulty={hud.difficulty}
        label={diffDef.label}
        labelColor={diffDef.color}
        myScore={lbScore}
      />
    </main>
  );
}

export const serpentine: GameDef = {
  id: "serpentine",
  name: "SERPENTINE",
  tagline: "Eat · Grow · Survive",
  accent: "text-lime",
  icon: <IconSnake />,
  readBest: () => {
    let max = 0;
    for (const d of DIFFICULTIES) {
      try {
        max = Math.max(max, Number(localStorage.getItem(`serpentine.best.${d.id}`) ?? 0) || 0);
      } catch {
        /* ignore */
      }
    }
    return max;
  },
  render: ({ onFullscreen, ...rest }) => <SnakeGame toggleFullscreen={onFullscreen} {...rest} />,
};