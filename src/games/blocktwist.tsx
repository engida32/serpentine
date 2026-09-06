import { useEffect, useRef, useState } from "react";
import { burst } from "../ui/confetti";
import { Blocks, BSIZE, type BTile, type BlockPhase } from "../game/block";
import { sfx } from "../game/audio";
import { recordPlay, unlockTrophy } from "../game/progress";
import type { DirName } from "../game/engine";
import { ArcadeButton, DPad, IconBtn, Stat } from "../ui/controls";
import {
  IconChevron,
  IconCrown,
  IconGrid,
  IconHome,
  IconRestart,
  IconSound,
  IconTrophy,
} from "../ui/icons";
import { isTypingTarget, useGamepad } from "../ui/input";
import { LeaderboardModal } from "../ui/LeaderboardModal";
import { ShareButton } from "../ui/ShareButton";
import type { SharePayload } from "../game/share";
import type { GameDef } from "./types";

const BEST_KEY = "serpentine.2048.best";
const CELL = 100 / BSIZE;

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function tileVisual(v: number): { cls: string; grad?: string } {
  if (v >= 2048) return { cls: "text-ink", grad: "linear-gradient(135deg,#ffe59a,#f0a92e)" };
  const map: Record<number, string> = {
    2: "bg-[#1f3529] text-foam",
    4: "bg-[#2b4d3a] text-foam",
    8: "bg-mint text-ink",
    16: "bg-lime text-ink",
    32: "bg-gold text-ink",
    64: "bg-[#ff9f5c] text-ink",
    128: "bg-coral text-ink",
    256: "bg-[#c84e46] text-foam",
    512: "bg-[#a03932] text-foam",
    1024: "bg-[#7a2b27] text-foam",
  };
  return { cls: map[v] ?? "bg-moss text-foam" };
}

function tileFont(v: number): string {
  if (v < 100) return "text-[22px] sm:text-[28px]";
  if (v < 1000) return "text-[18px] sm:text-[22px]";
  if (v < 10000) return "text-[14px] sm:text-[18px]";
  return "text-[11px] tv:text-lg sm:text-[14px]";
}

export function BlockGame({
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
  const engineRef = useRef<Blocks | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wonFiredRef = useRef(false);

  const [grid, setGrid] = useState<(BTile | null)[]>(() => new Array(BSIZE * BSIZE).fill(null));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [moves, setMoves] = useState(0);
  const [phase, setPhase] = useState<BlockPhase>("playing");
  const [newBest, setNewBest] = useState(false);
  const [winToast, setWinToast] = useState(false);
  const [boardSize, setBoardSize] = useState(320);
  const [lbOpen, setLbOpen] = useState(false);
  const [isCoarse] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
  );

  const eng = () => engineRef.current;

  const sync = () => {
    const e = eng();
    if (!e) return;
    setGrid([...e.grid]);
    setScore(e.score);
    setMoves(e.moves);
    setPhase(e.phase);
    if (e.score > e.best) {
      e.best = e.score;
      setBest(e.score);
      setNewBest(true);
      try {
        localStorage.setItem(BEST_KEY, String(e.score));
      } catch {
        /* ignore */
      }
    }
    if (e.won && !wonFiredRef.current) {
      wonFiredRef.current = true;
      setWinToast(true);
      sfx.record();
      for (let n = 0; n < 3; n++) {
        setTimeout(() => {
          burst({
            particleCount: 60,
            spread: 70,
            origin: { x: 0.5, y: 0.6 },
            colors: ["#a3f55a", "#3ddc84", "#ffcf5c", "#ff9f5c", "#ffffff"],
            zIndex: 200,
          });
        }, n * 500);
      }
    }
  };

  useEffect(() => {
    const e = new Blocks();
    e.best = readBest();
    engineRef.current = e;
    sync();
    const ro = new ResizeObserver(() => {
      const r = containerRef.current?.getBoundingClientRect();
      if (!r) return;
      const s = Math.max(240, Math.floor(Math.min(r.width, r.height)));
      setBoardSize(s);
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* trophies + session stats */
  useEffect(() => {
    let max = 0;
    for (const t of grid) if (t && t.v > max) max = t.v;
    let fresh = false;
    if (max >= 2048) fresh = unlockTrophy("block.2048") || fresh;
    if (max >= 4096) fresh = unlockTrophy("block.4096") || fresh;
    if (moves >= 100) fresh = unlockTrophy("block.marathon") || fresh;
    if (phase === "over") recordPlay(score);
    if (fresh) sfx.record();
  }, [phase, score, moves, grid]);

  const move = (dir: DirName) => {
    const e = eng();
    if (!e || e.phase === "over") return;
    const r = e.move(dir);
    if (!r.moved) return;
    if (r.gain > 0) {
      if (r.merged.length >= 2) sfx.combo();
      else sfx.merge();
    } else {
      sfx.slide();
    }
    sync();
  };

  const restart = () => {
    const e = eng();
    if (!e) return;
    sfx.unlock();
    e.reset();
    wonFiredRef.current = false;
    setWinToast(false);
    setNewBest(false);
    sync();
  };

  /* keyboard */
  useEffect(() => {
    const dirMap: Record<string, DirName> = {
      arrowup: "up", w: "up",
      arrowdown: "down", s: "down",
      arrowleft: "left", a: "left",
      arrowright: "right", d: "right",
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      sfx.unlock();
      const lower = e.key.toLowerCase();
      if (dirMap[lower]) {
        e.preventDefault();
        move(dirMap[lower]);
        return;
      }
      if (lower === "r") return restart();
      if (lower === "m") return onMute();
      if (lower === "f") return toggleFullscreen();
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (eng()?.phase === "over") restart();
        return;
      }
      if (e.key === "Escape" || lower === "goback" || e.keyCode === 461 || e.keyCode === 10009) {
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* gamepad */
  useGamepad({
    onDir: (d) => move(d),
    onPrimary: () => {
      if (eng()?.phase === "over") restart();
    },
    onStart: () => {
      if (eng()?.phase === "over") restart();
    },
    onBack: onExit,
  });

  /* swipe */
  const touchRef = useRef<{ x: number; y: number } | null>(null);
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
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  };

  const sharePayload: SharePayload = {
    game: "BLOCK TWIST",
    mode: "CLASSIC",
    score,
    extra: `tile ${Math.max(...grid.filter(Boolean).map((t) => t!.v), 2)}`,
  };

  return (
    <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center w-full max-w-[920px] mx-auto px-2 sm:px-4 gap-2 sm:gap-3 pt-2 sm:pt-3">
      {/* HUD */}
      <div
        className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 transition-[width] duration-150 ease-out shrink-0"
        style={{ width: Math.max(boardSize, 280) }}
      >
        <Stat label="SCORE">
          <span key={score} className="inline-block animate-pop text-lime">{score}</span>
        </Stat>
        <Stat label="BEST" accent="text-gold">
          <span className="inline-flex items-center gap-1.5">
            {newBest && <span className="text-gold animate-wiggle inline-block"><IconCrown className="w-3.5 h-3.5" /></span>}
            {best}
          </span>
        </Stat>
        <Stat label="MOVES" accent="text-mint">{moves}</Stat>
        <div className="flex items-center gap-1.5">
          <IconBtn title="Restart (R)" onClick={restart}>
            <IconRestart />
          </IconBtn>
        </div>
      </div>

      {/* board */}
      <div ref={containerRef} className="flex-1 min-h-0 w-full flex items-center justify-center">
        <div
          className="relative rounded-[10px] border-2 border-line bg-pit overflow-hidden select-none
            shadow-[0_0_70px_rgba(255,207,92,0.1),0_26px_60px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(6,17,12,0.9)]"
          style={{ width: boardSize, height: boardSize, touchAction: "none" }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* cell texture */}
          {Array.from({ length: BSIZE * BSIZE }, (_, i) => (
            <div
              key={`bg-${i}`}
              className="absolute rounded-[6px] bg-[rgba(61,220,132,0.05)] border border-line/40"
              style={{
                width: `${CELL}%`,
                height: `${CELL}%`,
                left: `${(i % BSIZE) * CELL}%`,
                top: `${Math.floor(i / BSIZE) * CELL}%`,
                padding: "4%",
                backgroundClip: "content-box",
              }}
            />
          ))}
          {/* tiles */}
          {grid.map((t, i) =>
            !t ? null : (
<div
                  key={t.id}
                  className="absolute tile-anim"
                  style={{
                    width: `${CELL}%`,
                    height: `${CELL}%`,
                    left: `${(i % BSIZE) * CELL}%`,
                    top: `${Math.floor(i / BSIZE) * CELL}%`,
                  }}
                >
                <div
                  className={`w-full h-full grid place-items-center rounded-md font-display ${tileFont(t.v)} ${tileVisual(t.v).cls}`}
                  style={tileVisual(t.v).grad ? { background: tileVisual(t.v).grad, boxShadow: "0 0 18px rgba(255,207,92,0.55)" } : undefined}
                >
                  {t.v}
                </div>
              </div>
            ),
          )}
          <div className="absolute inset-0 crt-lines pointer-events-none z-10 opacity-50" />
          <div className="absolute inset-0 board-vignette pointer-events-none z-10" />

          {/* 2048 reached toast */}
          {winToast && (
            <div className="absolute inset-0 z-20 grid place-items-center pointer-events-none">
              <div className="text-center animate-gopulse bg-[rgba(3,10,6,0.72)] border border-gold/50 rounded-lg px-5 py-4">
                <p className="font-display text-lg sm:text-xl text-gold" style={{ textShadow: "0 0 24px rgba(255,207,92,0.6)" }}>
                  2048!
                </p>
                <p className="text-fog text-xs tv:text-lg mt-2 tracking-[0.25em] uppercase">now keep going</p>
              </div>
            </div>
          )}

          {/* GAME OVER overlay */}
          {phase === "over" && (
            <div data-menu className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.9)] animate-rise p-4 overflow-y-auto">
              <p className="font-display text-lg sm:text-2xl text-coral" style={{ textShadow: "0 0 26px rgba(255,98,87,0.5)" }}>
                NO MOVES LEFT
              </p>
              <p className="text-fog text-sm tv:text-xl -mt-1">The grid is packed.</p>
              <div className="flex items-center gap-2 text-center">
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] tv:text-xs font-display text-fog mb-1">NODE</p>
                  <p className="font-display text-xs text-lime tabular-nums">{score}</p>
                </div>
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] tv:text-xs font-display text-fog mb-1">BEST</p>
                  <p className="font-display text-xs text-gold tabular-nums">{best}</p>
                </div>
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] tv:text-xs font-display text-fog mb-1">MOVES</p>
                  <p className="font-display text-xs text-mint tabular-nums">{moves}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <ArcadeButton variant="primary" data-autofocus big onClick={restart}>
                  <IconRestart /> Play Again
                </ArcadeButton>
                <ArcadeButton onClick={onExit}>
                  <IconHome /> Menu
                </ArcadeButton>
                <ArcadeButton onClick={() => setLbOpen(true)}>
                  <IconTrophy /> Save Score
                </ArcadeButton>
              </div>
              <ShareButton payload={sharePayload} />
            </div>
          )}
        </div>
      </div>

      {/* controls */}
      {isCoarse ? (
        <div className="shrink-0 pb-2 flex items-center justify-center gap-8">
          <div className="grid grid-cols-3 gap-1.5">
            <span />
            <DPad onPress={() => move("up")} label="Up"><IconChevron rotate={0} /></DPad>
            <span />
            <DPad onPress={() => move("left")} label="Left"><IconChevron rotate={-90} /></DPad>
            <DPad center onPress={() => eng()?.phase === "over" && restart()} label="Restart">
              <IconRestart />
            </DPad>
            <DPad onPress={() => move("right")} label="Right"><IconChevron rotate={90} /></DPad>
            <span />
            <DPad onPress={() => move("down")} label="Down"><IconChevron rotate={180} /></DPad>
            <span />
          </div>
          <div className="flex flex-col gap-1.5">
            <DPad wide onPress={onExit} label="Back to games">
              <IconHome />
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
            <span className="keycap">WASD</span> slide tiles
            <span className="text-line">·</span>
            <span className="keycap">R</span> restart
            <span className="text-line">·</span>
            <span className="keycap">F</span> fullscreen
          </p>
          <p className="font-display text-[7px] tv:text-[11px] text-fog/50 tracking-[0.3em] mt-1.5 uppercase">
            Slide · Merge · Reach 2048
          </p>
        </div>
      )}

      <LeaderboardModal
        open={lbOpen}
        onClose={() => setLbOpen(false)}
        difficulty="blocks"
        label="BLOCK TWIST"
        labelColor="#ffcf5c"
        myScore={score}
      />
    </main>
  );
}

export const blocktwist: GameDef = {
  id: "blocktwist",
  name: "BLOCK TWIST",
  tagline: "Slide · Merge · Reach 2048",
  accent: "text-gold",
  icon: <IconGrid />,
  readBest: () => {
    try {
      return Number(localStorage.getItem("serpentine.2048.best") ?? 0) || 0;
    } catch {
      return 0;
    }
  },
  render: ({ onFullscreen, ...rest }) => <BlockGame toggleFullscreen={onFullscreen} {...rest} />,
};