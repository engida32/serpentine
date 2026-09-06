import { useEffect, useRef, useState } from "react";
import { Sweeper, MINES, MSIZE, type SweepPhase, type MineCell } from "../game/minesweeper";
import { sfx } from "../game/audio";
import { recordPlay, unlockTrophy } from "../game/progress";
import { burst } from "../ui/confetti";
import type { DirName } from "../game/engine";
import { ArcadeButton, DPad, IconBtn, Stat } from "../ui/controls";
import { IconChevron, IconFlag, IconHome, IconMine, IconRestart, IconSound, IconTrophy } from "../ui/icons";
import { isTypingTarget, useGamepad, useShellBack } from "../ui/input";
import { ShareButton } from "../ui/ShareButton";
import { LeaderboardModal } from "../ui/LeaderboardModal";
import type { SharePayload } from "../game/share";
import type { GameDef } from "./types";

const BEST_KEY = "serpentine.mine.best";

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function secsOf(ms: number): number {
  return Math.round(ms / 100) / 10;
}

const NUM_COLOR = ["", "text-mint", "text-lime", "text-gold", "text-coral", "text-[#ff4d40]"];

export function SweeperGame({
  muted,
  onMute,
  onExit,
}: {
  muted: boolean;
  onMute: () => void;
  onExit: () => void;
  toggleFullscreen: () => void;
}) {
  const engineRef = useRef<Sweeper | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [grid, setGrid] = useState<MineCell[]>([]);
  const [phase, setPhase] = useState<SweepPhase>("idle");
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [time, setTime] = useState(0);
  const [flags, setFlags] = useState(0);
  const [best, setBest] = useState(readBest);
  const [boardSize, setBoardSize] = useState(320);
  const [lbOpen, setLbOpen] = useState(false);
  const [isCoarse] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
  );

  const eng = () => engineRef.current;

  useShellBack({
    phase,
    pausePhases: [],
    lbOpen,
    closeLb: () => setLbOpen(false),
    onExit,
  });

  const sync = () => {
    const e = eng();
    if (!e) return;
    setGrid([...e.grid]);
    setPhase(e.phase);
    setCursor({ x: e.cursorX, y: e.cursorY });
    setFlags(e.flagCount);
    setTime(e.time());
  };

  useEffect(() => {
    const e = new Sweeper();
    engineRef.current = e;
    sync();
    const ro = new ResizeObserver(() => {
      const r = containerRef.current?.getBoundingClientRect();
      if (!r) return;
      setBoardSize(Math.max(240, Math.floor(Math.min(r.width, r.height))));
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* timer while playing */
  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      const e = eng();
      if (e) setTime(e.time());
    }, 100);
    return () => window.clearInterval(id);
  }, [phase]);

  /* win/lose side effects */
  useEffect(() => {
    if (phase === "win") {
      const t = secsOf(time);
      if (t > 0 && (best === 0 || t < best)) {
        setBest(t);
        try {
          localStorage.setItem(BEST_KEY, String(t));
        } catch {
          /* ignore */
        }
      }
      sfx.record();
      burst({
        particleCount: 110,
        spread: 80,
        origin: { x: 0.5, y: 0.6 },
        colors: ["#a3f55a", "#3ddc84", "#ffcf5c", "#ffffff"],
        zIndex: 200,
      });
    } else if (phase === "over") {
      sfx.boom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* trophies + session stats */
  useEffect(() => {
    if (phase !== "win") return;
    recordPlay(0);
    let fresh = unlockTrophy("sweeper.clear");
    if (time < 30_000) fresh = unlockTrophy("sweeper.swift") || fresh;
    if (flags === 0) fresh = unlockTrophy("sweeper.noflags") || fresh;
    if (fresh) sfx.record();
  }, [phase, time, flags]);

  const reveal = (x: number, y: number) => {
    const e = eng();
    if (!e) return;
    if (phase === "idle") sfx.start();
    e.cursorX = x;
    e.cursorY = y;
    e.reveal(x, y);
    sfx.wall();
    sync();
  };

  const toggleFlag = (x: number, y: number) => {
    const e = eng();
    if (!e) return;
    e.toggleFlag(x, y);
    sfx.flag();
    sync();
  };

  const move = (d: DirName) => {
    const e = eng();
    if (!e) return;
    e.moveCursor(d);
    sync();
  };

  const restart = () => {
    const e = eng();
    if (!e) return;
    sfx.unlock();
    sfx.start();
    e.start();
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
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        reveal(eng()?.cursorX ?? 0, eng()?.cursorY ?? 0);
        return;
      }
      if (lower === "f") return toggleFlag(eng()?.cursorX ?? 0, eng()?.cursorY ?? 0);
      if (lower === "r") return restart();
      if (lower === "m") return onMute();
      // Back is handled by useBackHandler.
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* gamepad */
  useGamepad({
    onDir: (d) => move(d),
    onPrimary: () => reveal(eng()?.cursorX ?? 0, eng()?.cursorY ?? 0),
    onSecondary: () => toggleFlag(eng()?.cursorX ?? 0, eng()?.cursorY ?? 0),
    onStart: () => {
      if (eng()?.phase === "over" || eng()?.phase === "win") restart();
    },
    onBack: onExit,
  });

  const secs = secsOf(time);

  const sharePayload: SharePayload = {
    game: "SWEEPER",
    mode: "9X9 · 10 MINES",
    score: secs,
    extra: `cleared in ${secs}s`,
  };

  const cell = (x: number, y: number, i: number) => {
    const c = grid[i];
    const over = phase === "over";
    const selected = cursor.x === x && cursor.y === y && (phase === "playing" || phase === "idle");
    const unrevealed = over && !c.flag ? c.mine || c.revealed : !c.revealed;
    return (
      <button
        key={i}
        type="button"
        aria-label={`Cell ${x + 1},${y + 1}`}
        onPointerDown={(e) => {
          e.preventDefault();
          reveal(x, y);
        }}
        onContextMenu={(e) => e.preventDefault()}
        className={`
          relative rounded-[4px] border select-none touch-none
          ${unrevealed
            ? "bg-gradient-to-b from-[#17301f] to-[#0d2014] text-foam cursor-pointer"
            : c.mine
              ? c.boom ? "bg-[#5c1616] border-coral/60" : "bg-[#3a1d1a] border-line/50 opacity-85"
              : "bg-[rgba(61,220,132,0.05)] border-line/30"}
          ${selected ? "ring-[3px] ring-lime/80 border-line z-10" : "border-line/60"}
          transition-all duration-75
        `}
        style={{ aspectRatio: "1/1" }}
      >
        {unrevealed && c.flag && (
          <span className="absolute inset-0 grid place-items-center text-gold"><IconFlag className="w-[52%] h-[52%]" /></span>
        )}
        {!unrevealed && c.mine && (
          <span className="absolute inset-0 grid place-items-center text-coral"><IconMine className="w-[55%] h-[55%]" /></span>
        )}
        {!unrevealed && !c.mine && c.adj > 0 && (
          <span className={`absolute inset-0 grid place-items-center font-display text-[9px] tv:text-sm sm:text-[11px] tv:text-lg tabular-nums ${NUM_COLOR[c.adj] ?? "text-foam"}`}>
            {c.adj}
          </span>
        )}
      </button>
    );
  };

  return (
    <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center w-full max-w-[920px] mx-auto px-2 sm:px-4 gap-2 sm:gap-3 pt-2 sm:pt-3">
      <div
        className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 transition-[width] duration-150 ease-out shrink-0"
        style={{ width: Math.max(boardSize, 280) }}
      >
        <Stat label="TIME" accent="text-foam">
          <span className="tabular-nums">{(time / 1000).toFixed(1)}s</span>
        </Stat>
        <Stat label="MINES" accent="text-gold">{Math.max(0, MINES - flags)}</Stat>
        <Stat label="BEST" accent="text-mint">{best > 0 ? `${best}s` : "—"}</Stat>
        <div className="flex items-center gap-1.5">
          <IconBtn title="Leaderboard" onClick={() => setLbOpen(true)}><IconTrophy /></IconBtn>
          <IconBtn title="Restart (R)" onClick={restart}><IconRestart /></IconBtn>
          <IconBtn title="Back to games (ESC)" onClick={onExit}><IconHome /></IconBtn>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 w-full flex items-center justify-center">
        <div
          className="relative rounded-[10px] border-2 border-line bg-pit overflow-hidden select-none
            shadow-[0_0_70px_rgba(255,207,92,0.08),0_26px_60px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(6,17,12,0.9)]"
          style={{ width: boardSize, height: boardSize, touchAction: "manipulation" }}
        >
          <div className="absolute inset-0 p-[2.4%] sm:p-3">
            <div className="grid w-full h-full grid-cols-9 grid-rows-9 gap-[2px] sm:gap-1.5">
              {grid.map((_, i) => {
                const x = i % MSIZE;
                const y = Math.floor(i / MSIZE);
                return cell(x, y, i);
              })}
            </div>
          </div>
          <div className="absolute inset-0 crt-lines pointer-events-none z-10 opacity-40" />
          <div className="absolute inset-0 board-vignette pointer-events-none z-10" />

          {phase === "idle" && (
            <div data-menu className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.9)] animate-rise p-4 overflow-y-auto">
              <span className="text-gold"><IconMine /></span>
              <p className="font-display text-lg sm:text-xl text-gold" style={{ textShadow: "0 0 20px rgba(255,207,92,0.5)" }}>
                SWEEPER
              </p>
              <p className="text-fog text-sm tv:text-xl text-center max-w-[280px] leading-relaxed">
                {MINES} mines, 9x9 field. One reveal is always safe — the rest is up to you.
              </p>
              <ArcadeButton variant="primary" data-autofocus big onClick={restart}><IconRestart /> Play</ArcadeButton>
              <p className="text-[11px] tv:text-lg text-fog/80 flex items-center gap-1.5">
                {isCoarse ? (
                  <>Move with the pad, tap the centre to sweep, hold the flag button to mark</>
                ) : (
                  <>Arrows move · <span className="keycap">Enter</span> sweep · <span className="keycap">F</span> flag</>
                )}
              </p>
            </div>
          )}

          {(phase === "over" || phase === "win") && (
            <div data-menu className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.88)] animate-rise p-4 overflow-y-auto">
              <p
                className={`font-display text-lg sm:text-2xl ${phase === "win" ? "text-gold" : "text-coral"}`}
                style={{
                  textShadow:
                    phase === "win" ? "0 0 26px rgba(255,207,92,0.55)" : "0 0 26px rgba(255,98,87,0.5)",
                }}
              >
                {phase === "win" ? "FIELD CLEARED" : "MINE DETONATED"}
              </p>
              <p className="text-fog text-sm tv:text-xl -mt-1">
                {phase === "win" ? `${secs}s flat.` : "You'll get it next sweep."}
              </p>
              <div className="flex items-center gap-2">
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] tv:text-xs font-display text-fog mb-1">TIME</p>
                  <p className="font-display text-xs text-lime tabular-nums">{secs}s</p>
                </div>
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] tv:text-xs font-display text-fog mb-1">BEST</p>
                  <p className="font-display text-xs text-gold tabular-nums">{best > 0 ? `${best}s` : "—"}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <ArcadeButton variant="primary" data-autofocus big onClick={restart}><IconRestart /> Play Again</ArcadeButton>
                <ArcadeButton onClick={onExit}><IconHome /> Menu</ArcadeButton>
              </div>
              <ShareButton payload={sharePayload} />
            </div>
          )}
        </div>
      </div>

      {isCoarse ? (
        <div className="shrink-0 pb-2 flex items-center justify-center gap-8">
          <div className="grid grid-cols-3 gap-1.5">
            <span />
            <DPad onPress={() => move("up")} label="Up"><IconChevron rotate={0} /></DPad>
            <span />
            <DPad onPress={() => move("left")} label="Left"><IconChevron rotate={-90} /></DPad>
            <DPad center onPress={() => reveal(eng()?.cursorX ?? 0, eng()?.cursorY ?? 0)} label="Sweep">
              <IconMine />
            </DPad>
            <DPad onPress={() => move("right")} label="Right"><IconChevron rotate={90} /></DPad>
            <span />
            <DPad onPress={() => move("down")} label="Down"><IconChevron rotate={180} /></DPad>
            <span />
          </div>
          <div className="flex flex-col gap-1.5">
            <DPad wide onPress={() => toggleFlag(eng()?.cursorX ?? 0, eng()?.cursorY ?? 0)} label="Toggle flag">
              <IconFlag />
            </DPad>
            <DPad wide onPress={onMute} label="Toggle sound">
              <IconSound muted={muted} />
            </DPad>
          </div>
        </div>
      ) : (
        <div className="shrink-0 pb-2 sm:pb-3 text-center">
          <p className="text-[11px] tv:text-lg text-fog/85 flex items-center justify-center gap-x-2 gap-y-1 flex-wrap">
            <span className="keycap">↑</span><span className="keycap">↓</span><span className="keycap">←</span><span className="keycap">→</span> move ·
            <span className="keycap">Enter</span> sweep · <span className="keycap">F</span> flag ·
            <span className="keycap">R</span> restart
          </p>
          <p className="font-display text-[7px] tv:text-[11px] text-fog/50 tracking-[0.3em] mt-1.5 uppercase">
            Sweep · Mark · Then pray
          </p>
        </div>
      )}

      <LeaderboardModal
        open={lbOpen}
        onClose={() => setLbOpen(false)}
        difficulty="sweeper"
        label="9X9 · 10 MINES"
        labelColor="#ffcf5c"
        ascending
        myScore={phase === "win" ? secs : 0}
      />
    </main>
  );
}

export const sweeper: GameDef = {
  id: "sweeper",
  name: "SWEEPER",
  tagline: "Sweep · Mark · Then pray",
  accent: "text-gold",
  icon: <IconMine />,
  readBest: readBest,
  render: ({ onFullscreen, ...rest }) => <SweeperGame toggleFullscreen={onFullscreen} {...rest} />,
};