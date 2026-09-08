import { useEffect, useRef, useState, useCallback } from "react";
import { burst } from "../ui/confetti";
import { Invaders, type InvHud } from "../game/invaders";
import { sfx } from "../game/audio";
import { recordPlay, unlockTrophy } from "../game/progress";
import { ArcadeButton, HoldPad, IconBtn, MuteBtn, Stat } from "../ui/controls";
import { IconHome, IconInvaders, IconPause, IconPlay, IconRestart, IconSound, IconTrophy } from "../ui/icons";
import { isTypingTarget, useGamepad, useRemoteHeld, useShellBack } from "../ui/input";
import { useControlMode } from "../ui/useDisplayMode";
import { ShareButton } from "../ui/ShareButton";
import { LeaderboardModal } from "../ui/LeaderboardModal";
import type { SharePayload } from "../game/share";
import type { GameDef } from "./types";

const CONFIG = {
  BEST_KEY: "serpentine.invaders.best",
  MIN_SIZE: 240,
  MAX_DPR: 2,
};
const INITIAL_HUD: InvHud = { phase: "idle", score: 0, lives: 3, best: 0 };

function readBest(): number {
  try {
    const raw = localStorage.getItem(CONFIG.BEST_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'number' && !isNaN(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function InvadersGame({
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
  const engineRef = useRef<Invaders | null>(null);
  const touchRef = useRef(false);
  const { held, setManual } = useRemoteHeld();

  const [hud, setHud] = useState<InvHud>(INITIAL_HUD);
  const [boardSize, setBoardSize] = useState(320);
  const [lbOpen, setLbOpen] = useState(false);
  const { isTouch } = useControlMode();

  const eng = () => engineRef.current;

  useShellBack({
    phase: hud.phase,
    pausePhases: ["playing"],
    enterPause: () => eng()?.togglePause(),
    lbOpen,
    closeLb: () => setLbOpen(false),
    onExit,
  });

  useGamepad({
    onSecondary: () => eng()?.togglePause(),
    onStart: () => eng()?.togglePause(),
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const e = new Invaders(canvas, setHud, held, readBest());
    engineRef.current = e;
    const ro = new ResizeObserver(() => {
      const r = container.getBoundingClientRect();
      const s = Math.max(CONFIG.MIN_SIZE, Math.floor(Math.min(r.width, r.height)));
      setBoardSize(s);
      e.resize(s, s, Math.min(window.devicePixelRatio || 1, 2));
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      e.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hud.score > readBest()) {
      try {
        localStorage.setItem(BEST_KEY, String(hud.score));
      } catch {
        /* ignore */
      }
    }
    if (hud.phase === "win") {
      burst({
        particleCount: 110,
        spread: 80,
        origin: { x: 0.5, y: 0.6 },
        colors: ["#a3f55a", "#3ddc84", "#ffcf5c", "#ff6257", "#ffffff"],
        zIndex: 200,
      });
    }
  }, [hud.phase, hud.score]);

  /* trophies + session stats */
  useEffect(() => {
    let fresh = false;
    if (hud.phase === "win") fresh = unlockTrophy("invaders.planet") || fresh;
    if (hud.score >= 10_000) fresh = unlockTrophy("invaders.10k") || fresh;
    if (hud.phase === "over" || hud.phase === "win") recordPlay(hud.score);
    if (fresh) sfx.record();
  }, [hud.phase, hud.score]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      sfx.unlock();
      const g = eng();
      const lower = e.key.toLowerCase();
      if (lower === "r") return start();
      if (lower === "m") return onMute();
      if (lower === "f") return toggleFullscreen();
      if (lower === "p") return g?.togglePause();
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (g && (g.phase === "idle" || g.phase === "over" || g.phase === "win")) start();
        return;
      }
      // Back is handled by useBackHandler.
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(() => {
    // wrapped in useCallback
    sfx.unlock();
    sfx.start();
    eng()?.start();
  }, []);

  const sharePayload: SharePayload = {
    game: "SPACE INVADERS",
    mode: "WAVE 1",
    score: hud.score,
    extra: hud.phase === "win" ? "planet defended" : `${hud.lives} ship${hud.lives === 1 ? "" : "s"} down`,
  };

  return (
    <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center w-full max-w-[920px] mx-auto px-2 sm:px-4 gap-2 sm:gap-3 pt-2 sm:pt-3">
      <div
        className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 transition-[width] duration-150 ease-out shrink-0"
        style={{ width: Math.max(boardSize, 280) }}
      >
        <Stat label="SCORE">
          <span key={hud.score} className="inline-block animate-pop text-lime">{hud.score}</span>
        </Stat>
        <Stat label="BEST" accent="text-gold">{hud.best}</Stat>
        <Stat label="SHIPS" accent="text-coral">
          {"▲".repeat(Math.max(0, hud.lives))}
        </Stat>
        <div className="flex items-center gap-1.5">
          <IconBtn
            title={hud.phase === "paused" ? "Resume (P)" : "Pause (P)"}
            disabled={hud.phase !== "playing" && hud.phase !== "paused"}
            onClick={() => eng()?.togglePause()}
          >
            {hud.phase === "paused" ? <IconPlay /> : <IconPause />}
          </IconBtn>
          <IconBtn title="Leaderboard" onClick={() => setLbOpen(true)}><IconTrophy /></IconBtn>
          <IconBtn title="Restart (R)" onClick={start}><IconRestart /></IconBtn>
          <IconBtn title="Back to games (ESC)" onClick={onExit}><IconHome /></IconBtn>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 w-full flex items-center justify-center">
        <div
          className="relative rounded-[10px] border-2 border-line bg-pit overflow-hidden select-none
            shadow-[0_0_70px_rgba(255,98,87,0.1),0_26px_60px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(6,17,12,0.9)]"
          style={{ width: boardSize, height: boardSize, touchAction: "none" }}
          onPointerDown={(e) => {
            touchRef.current = true;
            sfx.unlock();
            eng()?.setTouchX(e.clientX - e.currentTarget.getBoundingClientRect().left);
          }}
          onPointerMove={(e) => {
            if (touchRef.current)
              eng()?.setTouchX(e.clientX - e.currentTarget.getBoundingClientRect().left);
          }}
          onPointerUp={() => {
            touchRef.current = false;
            eng()?.setTouchX(null);
          }}
          onPointerLeave={() => {
            touchRef.current = false;
            eng()?.setTouchX(null);
          }}
          onPointerCancel={() => {
            touchRef.current = false;
            eng()?.setTouchX(null);
          }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full block"
            role="img"
            aria-label="Game canvas. Use arrow keys to move, space to interact."
            tabIndex={0}
          />
          <div className="absolute inset-0 crt-lines pointer-events-none z-10 opacity-50" />
          <div className="absolute inset-0 board-vignette pointer-events-none z-10" />

          {hud.phase === "idle" && (
            <div data-menu className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.9)] animate-rise p-4 overflow-y-auto">
              <span className="text-coral"><IconInvaders /></span>
              <p className="font-display text-lg sm:text-xl text-coral" style={{ textShadow: "0 0 20px rgba(255,98,87,0.5)" }}>
                SPACE INVADERS
              </p>
              <p className="text-fog text-sm tv:text-xl text-center max-w-[280px] leading-relaxed">
                Hold the line. Sweep the invaders, dodge their fire, defend the planet.
              </p>
              <ArcadeButton variant="primary" data-autofocus big onClick={start}><IconRestart /> Play</ArcadeButton>
              <MuteBtn muted={muted} onToggle={onMute} />
              <p className="text-[11px] tv:text-lg text-fog/80 flex items-center gap-1.5">
                {isTouch ? (
                  <>Hold <span className="keycap">◀</span><span className="keycap">▶</span> to move, tap <span className="keycap">●</span> to fire</>
                ) : (
                  <><span className="keycap">◀</span><span className="keycap">▶</span> or mouse to move · <span className="keycap">Space</span> fire · <span className="keycap">Enter</span> to play</>
                )}
              </p>
            </div>
          )}

          {hud.phase === "paused" && (
            <div data-menu className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.86)] animate-rise p-4">
              <p className="font-display text-lg sm:text-xl text-coral" style={{ textShadow: "0 0 20px rgba(255,98,87,0.5)" }}>
                PAUSED
              </p>
              <p className="text-fog text-sm tv:text-xl -mt-1">The fleet holds its fire…</p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <ArcadeButton variant="primary" data-autofocus onClick={() => eng()?.togglePause()}><IconPlay /> Resume</ArcadeButton>
                <ArcadeButton onClick={start}><IconRestart /> Restart</ArcadeButton>
                <ArcadeButton onClick={onExit}><IconHome /> Menu</ArcadeButton>
                <MuteBtn muted={muted} onToggle={onMute} />
              </div>
              <p className="text-[11px] tv:text-lg text-fog/80 flex items-center gap-1.5">
                <span className="keycap">P</span> to resume
              </p>
            </div>
          )}

          {(hud.phase === "over" || hud.phase === "win") && (
            <div data-menu className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.88)] animate-rise p-4 overflow-y-auto">
              <p
                className={`font-display text-lg sm:text-2xl ${hud.phase === "win" ? "text-gold" : "text-coral"}`}
                style={{
                  textShadow:
                    hud.phase === "win" ? "0 0 26px rgba(255,207,92,0.55)" : "0 0 26px rgba(255,98,87,0.5)",
                }}
              >
                {hud.phase === "win" ? "PLANET DEFENDED" : "THE INVASION WINS"}
              </p>
              <p className="text-fog text-sm tv:text-xl -mt-1">
                {hud.phase === "win" ? "Every invader is gone." : "The fleet reached the deck."}
              </p>
              <div className="flex items-center gap-2">
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] tv:text-xs font-display text-fog mb-1">SCORE</p>
                  <p className="font-display text-xs text-lime tabular-nums">{hud.score}</p>
                </div>
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] tv:text-xs font-display text-fog mb-1">BEST</p>
                  <p className="font-display text-xs text-gold tabular-nums">{hud.best}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <ArcadeButton variant="primary" data-autofocus big onClick={start}><IconRestart /> Play Again</ArcadeButton>
                <ArcadeButton onClick={onExit}><IconHome /> Menu</ArcadeButton>
                <MuteBtn muted={muted} onToggle={onMute} />
              </div>
              <ShareButton payload={sharePayload} />
            </div>
          )}
        </div>
      </div>

      {isTouch ? (
        <div className="shrink-0 pb-2 flex items-center justify-center gap-5">
          <HoldPad dir="left" label="Move left" onHold={(v) => setManual("left", v)} />
          <HoldPad dir="right" label="Move right" onHold={(v) => setManual("right", v)} />
          <HoldPad dir="up" ghost label="Fire" onHold={(v) => v && setManual("fire", true)} />
          <IconBtn title="Toggle sound" onClick={onMute}><IconSound muted={muted} /></IconBtn>
        </div>
      ) : (
        <div className="shrink-0 pb-2 sm:pb-3 text-center">
          <p className="text-[11px] tv:text-lg text-fog/85 flex items-center justify-center gap-x-2 gap-y-1 flex-wrap">
            Mouse or <span className="keycap">←</span><span className="keycap">→</span> to move ·
            <span className="keycap">Space</span> fire · <span className="keycap">Enter</span> play/restart ·{" "}
            <span className="keycap">R</span> restart · <span className="keycap">P</span> pause · <span className="keycap">F</span> fullscreen
          </p>
          <p className="font-display text-[7px] tv:text-[11px] text-fog/50 tracking-[0.3em] mt-1.5 uppercase">
            Sweep · Dodge · Defend
          </p>
        </div>
      )}

      <LeaderboardModal
        open={lbOpen}
        onClose={() => setLbOpen(false)}
        difficulty="invaders"
        label="WAVE"
        labelColor="#ff6257"
        myScore={hud.phase === "over" || hud.phase === "win" ? hud.score : 0}
      />
    </main>
  );
}

export const invaders: GameDef = {
  id: "invaders",
  name: "SPACE INVADERS",
  tagline: "Sweep · Dodge · Defend",
  accent: "text-coral",
  icon: <IconInvaders />,
  readBest: readBest,
  render: ({ onFullscreen, ...rest }) => <InvadersGame toggleFullscreen={onFullscreen} {...rest} />,
};