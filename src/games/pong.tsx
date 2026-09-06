import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { PongEngine, POINT_TARGET, type PongHud } from "../game/pong";
import { sfx } from "../game/audio";
import { ArcadeButton, IconBtn, Stat } from "../ui/controls";
import { IconChevron, IconHome, IconPong, IconRestart, IconSound } from "../ui/icons";
import { ShareButton } from "../ui/ShareButton";
import type { SharePayload } from "../game/share";
import type { GameDef } from "./types";

const INITIAL_HUD: PongHud = { phase: "idle", l: 0, r: 0, winner: null };

const UP_KEYS = new Set(["arrowup", "w", "W"]);
const DOWN_KEYS = new Set(["arrowdown", "s", "S"]);

function HoldPad({ dir, onHold }: { dir: "up" | "down"; onHold: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-label={dir === "up" ? "Paddle up" : "Paddle down"}
      onPointerDown={(e) => {
        e.preventDefault();
        sfx.unlock();
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      className="w-[60px] h-[52px] grid place-items-center rounded-lg border border-line border-b-4 border-b-[#04100a]
        bg-gradient-to-b from-fern to-moss text-mint active:text-lime active:translate-y-[2px] active:border-b-2
        transition-all duration-75 touch-none cursor-pointer select-none"
    >
      <IconChevron rotate={dir === "up" ? 0 : 180} />
    </button>
  );
}

function DPadRestart({ onPress }: { onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label="Restart"
      onPointerDown={(e) => {
        e.preventDefault();
        sfx.unlock();
        onPress();
      }}
      className="w-[52px] h-[52px] grid place-items-center rounded-lg border border-line border-b-4 border-b-[#04100a] bg-gradient-to-b from-moss to-pit text-lime active:translate-y-[2px] active:border-b-2 transition-all touch-none cursor-pointer"
    >
      <IconRestart />
    </button>
  );
}

export function PongGame({
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
  const engineRef = useRef<PongEngine | null>(null);
  const pressedRef = useRef<Set<string>>(new Set());
  const pressingTouch = useRef(false);

  const [hud, setHud] = useState<PongHud>(INITIAL_HUD);
  const [boardSize, setBoardSize] = useState(320);
  const [isCoarse] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
  );

  const eng = () => engineRef.current;

  const pushInput = () => {
    const e = eng();
    if (!e) return;
    e.setPlayerUp(pressedRef.current.size > 0 && [...pressedRef.current].some((k) => UP_KEYS.has(k)));
    e.setPlayerDown(pressedRef.current.size > 0 && [...pressedRef.current].some((k) => DOWN_KEYS.has(k)));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const eng2 = new PongEngine(canvas, setHud);
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

  /* keyboard: held directions + shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      sfx.unlock();
      pressedRef.current.add(e.key);
      if (UP_KEYS.has(e.key) || DOWN_KEYS.has(e.key)) e.preventDefault();
      pushInput();
      const lower = e.key.toLowerCase();
      if (lower === "r") return eng()?.start();
      if (lower === "m") return onMute();
      if (lower === "f") return toggleFullscreen();
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const ph = eng()?.getPhase();
        if (ph === "idle" || ph === "over") eng()?.start();
        return;
      }
      if (e.key === "Escape" || lower === "goback" || e.keyCode === 461 || e.keyCode === 10009) {
        onExit();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      pressedRef.current.delete(e.key);
      pushInput();
    };
    const onVis = () => {
      if (document.hidden) pressedRef.current.clear();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* gamepad: held vertical input */
  useEffect(() => {
    const id = window.setInterval(() => {
      const e = eng();
      if (!e) return;
      let gp: Gamepad | null = null;
      try {
        gp = navigator.getGamepads?.()[0] ?? null;
      } catch {
        gp = null;
      }
      if (!gp) return;
      const up = (gp.buttons[12]?.pressed && gp.buttons[12].value > 0) || (gp.axes[1] ?? 0) < -0.5;
      const down = (gp.buttons[13]?.pressed && gp.buttons[13].value > 0) || (gp.axes[1] ?? 0) > 0.5;
      e.setPlayerUp(up);
      e.setPlayerDown(down);
    }, 60);
    return () => window.clearInterval(id);
  }, []);

  /* confetti on player victory */
  useEffect(() => {
    if (hud.phase === "over" && hud.winner === 0) {
      for (let n = 0; n < 3; n++) {
        setTimeout(() => {
          confetti({
            particleCount: 70,
            spread: 75,
            origin: { x: 0.5, y: 0.6 },
            colors: ["#a3f55a", "#ffcf5c", "#c8ff70", "#ffffff"],
            zIndex: 200,
          });
        }, n * 450);
      }
    } else if (hud.phase === "over" && hud.winner === 1) {
      sfx.gameover();
    }
  }, [hud.phase, hud.winner]);

  const start = () => {
    sfx.unlock();
    sfx.start();
    eng()?.start();
  };

  /* touch: finger follows paddle */
  const boardRect = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientY - rect.top;
  };

  const sharePayload: SharePayload = {
    game: "NEON PONG",
    mode: "VS GHOST",
    score: hud.l,
    extra: `first to ${POINT_TARGET}`,
  };

  return (
    <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center w-full max-w-[920px] mx-auto px-2 sm:px-4 gap-2 sm:gap-3 pt-2 sm:pt-3">
      {/* HUD */}
      <div
        className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 transition-[width] duration-150 ease-out shrink-0"
        style={{ width: Math.max(boardSize, 280) }}
      >
        <Stat label="YOU" accent="text-lime">
          <span key={hud.l} className="inline-block animate-pop">{hud.l}</span>
        </Stat>
        <Stat label="GHOST" accent="text-coral">
          <span key={hud.r} className="inline-block animate-pop">{hud.r}</span>
        </Stat>
        <div className="flex items-center gap-2 bg-pit/90 border border-line rounded-md px-3 py-2">
          <span className="font-display text-[8px] text-fog tracking-wider">TARGET</span>
          <span className="font-display text-sm text-gold tabular-nums">{POINT_TARGET}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <IconBtn title="Restart (R)" onClick={() => eng()?.start()}>
            <IconRestart />
          </IconBtn>
          <IconBtn title="Back to games (ESC)" onClick={onExit}>
            <IconHome />
          </IconBtn>
        </div>
      </div>

      {/* board */}
      <div ref={containerRef} className="flex-1 min-h-0 w-full flex items-center justify-center">
        <div
          className="relative rounded-[10px] border-2 border-line bg-pit overflow-hidden select-none
            shadow-[0_0_70px_rgba(61,220,132,0.12),0_26px_60px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(6,17,12,0.9)]"
          style={{ width: boardSize, height: boardSize, touchAction: "none" }}
          onPointerDown={(e) => {
            pressingTouch.current = true;
            sfx.unlock();
            eng()?.setTouchTarget(boardRect(e));
          }}
          onPointerMove={(e) => {
            if (pressingTouch.current) eng()?.setTouchTarget(boardRect(e));
          }}
          onPointerUp={() => {
            pressingTouch.current = false;
            eng()?.setTouchTarget(null);
          }}
          onPointerLeave={() => {
            pressingTouch.current = false;
            eng()?.setTouchTarget(null);
          }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
          <div className="absolute inset-0 crt-lines pointer-events-none z-10 opacity-50" />
          <div className="absolute inset-0 board-vignette pointer-events-none z-10" />

          {/* MENU */}
          {hud.phase === "idle" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.9)] animate-rise p-4 overflow-y-auto">
              <span className="text-coral"><IconPong /></span>
              <p className="font-display text-lg sm:text-xl text-mint" style={{ textShadow: "0 0 20px rgba(163,245,90,0.5)" }}>
                NEON PONG
              </p>
              <p className="text-fog text-sm text-center max-w-[260px] leading-relaxed">
                Face The Ghost across the net. First to {POINT_TARGET} points wins.
              </p>
              <ArcadeButton variant="primary" big onClick={start}>
                <IconRestart /> Play
              </ArcadeButton>
              <p className="text-[11px] text-fog/80 flex items-center gap-1.5">
                {isCoarse ? (
                  <>Hold the pad (or touch) to steer your paddle</>
                ) : (
                  <>
                    Hold <span className="keycap">↑</span><span className="keycap">↓</span>or{" "}
                    <span className="keycap">W</span><span className="keycap">S</span> to move ·{" "}
                    <span className="keycap">Enter</span> to play
                  </>
                )}
              </p>
            </div>
          )}

          {/* GAME OVER */}
          {hud.phase === "over" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.88)] animate-rise p-4 overflow-y-auto">
              <p
                className={`font-display text-lg sm:text-2xl ${hud.winner === 0 ? "text-gold" : "text-coral"}`}
                style={{
                  textShadow:
                    hud.winner === 0 ? "0 0 26px rgba(255,207,92,0.55)" : "0 0 26px rgba(255,98,87,0.5)",
                }}
              >
                {hud.winner === 0 ? "YOU WIN" : "THE GHOST WINS"}
              </p>
              <p className="text-fog text-sm -mt-1">
                {hud.winner === 0 ? "The ghost resigns. Well played." : "Maybe next rally…"}
              </p>
              <div className="flex items-center gap-2 text-center">
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] font-display text-fog mb-1">YOU</p>
                  <p className="font-display text-xs text-lime tabular-nums">{hud.l}</p>
                </div>
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] font-display text-fog mb-1">GHOST</p>
                  <p className="font-display text-xs text-coral tabular-nums">{hud.r}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <ArcadeButton variant="primary" big onClick={start}>
                  <IconRestart /> Play Again
                </ArcadeButton>
                <ArcadeButton onClick={onExit}>
                  <IconHome /> Menu
                </ArcadeButton>
              </div>
              <ShareButton payload={sharePayload} />
            </div>
          )}
        </div>
      </div>

      {/* controls */}
      {isCoarse ? (
        <div className="shrink-0 pb-2 flex items-center justify-center gap-5">
          <HoldPad dir="up" onHold={(v) => eng()?.setPlayerUp(v)} />
          <DPadRestart onPress={() => eng()?.start()} />
          <HoldPad dir="down" onHold={(v) => eng()?.setPlayerDown(v)} />
          <button
            type="button"
            onPointerDown={() => {
              sfx.unlock();
              onMute();
            }}
            className="w-[52px] h-[52px] grid place-items-center rounded-lg border border-line border-b-4 border-b-[#04100a] bg-gradient-to-b from-fern to-moss text-mint active:translate-y-[2px] active:border-b-2 transition-all touch-none cursor-pointer"
          >
            <IconSound muted={muted} />
          </button>
        </div>
      ) : (
        <div className="shrink-0 pb-2 sm:pb-3 text-center">
          <p className="text-[11px] text-fog/85 flex items-center justify-center gap-x-2 gap-y-1 flex-wrap">
            Hold <span className="keycap">↑</span><span className="keycap">↓</span> or{" "}
            <span className="keycap">W</span><span className="keycap">S</span> to move ·{" "}
            <span className="keycap">R</span> restart · <span className="keycap">F</span> fullscreen
          </p>
          <p className="font-display text-[7px] text-fog/50 tracking-[0.3em] mt-1.5 uppercase">
            First to {POINT_TARGET} · Return · Repeat
          </p>
        </div>
      )}
    </main>
  );
}

export const pong: GameDef = {
  id: "pong",
  name: "NEON PONG",
  tagline: "Face The Ghost. First to 7",
  accent: "text-coral",
  icon: <IconPong />,
  render: ({ onFullscreen, ...rest }) => <PongGame toggleFullscreen={onFullscreen} {...rest} />,
};