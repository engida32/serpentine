import { useEffect, useRef, useState } from "react";
import { Memory, MCOL, MROW, SYMBOLS, type MemPhase } from "../game/memory";
import { sfx } from "../game/audio";
import { recordPlay, unlockTrophy } from "../game/progress";
import { burst } from "../ui/confetti";
import type { DirName } from "../game/engine";
import { ArcadeButton, DPad, IconBtn, Stat } from "../ui/controls";
import { IconChevron, IconHome, IconMemory, IconQuestion, IconRestart, IconSound, IconTrophy } from "../ui/icons";
import { isTypingTarget, useGamepad } from "../ui/input";
import { ShareButton } from "../ui/ShareButton";
import { LeaderboardModal } from "../ui/LeaderboardModal";
import type { SharePayload } from "../game/share";
import type { GameDef } from "./types";

const BEST_KEY = "serpentine.memory.best";

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function MemoryGame({
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
  const engineRef = useRef<Memory | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  const [grid, setGrid] = useState<typeof Memory.prototype.grid>([]);
  const [phase, setPhase] = useState<MemPhase>("idle");
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [moves, setMoves] = useState(0);
  const [best, setBest] = useState(readBest);
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
    setPhase(e.phase);
    setCursor({ x: e.cursorX, y: e.cursorY });
    setMoves(e.moves);
  };

  useEffect(() => {
    const e = new Memory();
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
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "win") {
      if (moves > 0 && (best === 0 || moves < best)) {
        setBest(moves);
        try {
          localStorage.setItem(BEST_KEY, String(moves));
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* trophies + session stats */
  useEffect(() => {
    if (phase !== "win") return;
    recordPlay(0);
    let fresh = false;
    if (moves <= 8) fresh = unlockTrophy("memory.perfect") || fresh;
    if (moves <= 12) fresh = unlockTrophy("memory.ninja") || fresh;
    if (fresh) sfx.record();
  }, [phase, moves]);

  const flip = (x: number, y: number) => {
    const e = eng();
    if (!e) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
      e.closeMismatch();
    }
    const r = e.flip(x, y);
    if (!r) return;
    if (e.phase === "idle" || phase === "idle") sfx.start();
    e.cursorX = x;
    e.cursorY = y;
    if (r.type === "match") sfx.merge();
    else if (r.type === "await") {
      sfx.slide();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        e.closeMismatch();
        sync();
      }, 750);
    } else {
      sfx.place();
    }
    sync();
  };

  const move = (d: DirName) => {
    const e = eng();
    if (!e) return;
    if (timerRef.current !== null) return;
    e.moveCursor(d);
    sync();
  };

  const restart = () => {
    const e = eng();
    if (!e) return;
    sfx.unlock();
    sfx.start();
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    e.start();
    sync();
  };

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
        flip(eng()?.cursorX ?? 0, eng()?.cursorY ?? 0);
        return;
      }
      if (lower === "r") return restart();
      if (lower === "m") return onMute();
      if (lower === "f") return toggleFullscreen();
      if (e.key === "Escape" || lower === "goback" || e.keyCode === 461 || e.keyCode === 10009) onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useGamepad({
    onDir: (d) => move(d),
    onPrimary: () => flip(eng()?.cursorX ?? 0, eng()?.cursorY ?? 0),
    onStart: () => {
      if (eng()?.phase === "win") restart();
    },
    onBack: onExit,
  });

  const sharePayload: SharePayload = {
    game: "MEMORY",
    mode: "4X4 MATCH",
    score: moves,
    extra: "all pairs found",
  };

  const card = (x: number, y: number) => {
    const i = y * MCOL + x;
    const c = grid[i];
    const selected = cursor.x === x && cursor.y === y && phase !== "win" && !eng()?.pending;
    const up = c.face || c.matched;
    return (
      <button
        key={i}
        type="button"
        aria-label={`Card ${x + 1},${y + 1}`}
        onPointerDown={(e) => {
          e.preventDefault();
          flip(x, y);
        }}
        className={`
          relative rounded-md border select-none touch-none grid place-items-center
          transition-all duration-150
          ${c.matched
            ? "bg-gradient-to-b from-[#3a4a2a] to-[#24301a] border-gold/60 text-gold"
            : up
              ? "bg-gradient-to-b from-fern to-moss border-lime/50 text-lime"
              : "bg-gradient-to-b from-[#17301f] to-[#0d2014] border-line/60 text-fog"}
          ${selected ? "ring-[3px] ring-lime/80 border-line z-10" : ""}
          cursor-pointer
        `}
        style={{ aspectRatio: "1/1" }}
      >
        <span className={`font-display text-[14px] sm:text-2xl ${c.matched ? "text-gold" : "text-lime"}`}>
          {up ? SYMBOLS[c.value] : <IconQuestion />}
        </span>
      </button>
    );
  };

  return (
    <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center w-full max-w-[920px] mx-auto px-2 sm:px-4 gap-2 sm:gap-3 pt-2 sm:pt-3">
      <div
        className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 transition-[width] duration-150 ease-out shrink-0"
        style={{ width: Math.max(boardSize, 280) }}
      >
        <Stat label="MOVES">
          <span key={moves} className="inline-block animate-pop text-lime">{moves}</span>
        </Stat>
        <Stat label="PAIRS" accent="text-gold">{grid.filter((t) => t.matched).length} / 8</Stat>
        <Stat label="BEST" accent="text-mint">{best > 0 ? best : "—"}</Stat>
        <div className="flex items-center gap-1.5">
          <IconBtn title="Leaderboard" onClick={() => setLbOpen(true)}><IconTrophy /></IconBtn>
          <IconBtn title="Restart (R)" onClick={restart}><IconRestart /></IconBtn>
          <IconBtn title="Back to games (ESC)" onClick={onExit}><IconHome /></IconBtn>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 w-full flex items-center justify-center">
        <div
          className="relative rounded-[10px] border-2 border-line bg-pit overflow-hidden select-none
            shadow-[0_0_70px_rgba(163,245,90,0.1),0_26px_60px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(6,17,12,0.9)]"
          style={{ width: boardSize, height: boardSize, touchAction: "manipulation" }}
        >
          <div className="absolute inset-0 p-[2.4%] sm:p-3">
            <div className="grid w-full h-full grid-cols-4 grid-rows-4 gap-[2.5%] sm:gap-3">
              {grid.map((_, i) => card(i % MCOL, Math.floor(i / MCOL)))}
            </div>
          </div>
          <div className="absolute inset-0 crt-lines pointer-events-none z-10 opacity-40" />
          <div className="absolute inset-0 board-vignette pointer-events-none z-10" />

          {phase === "idle" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.9)] animate-rise p-4 overflow-y-auto">
              <span className="text-lime"><IconMemory /></span>
              <p className="font-display text-lg sm:text-xl text-lime" style={{ textShadow: "0 0 20px rgba(163,245,90,0.5)" }}>
                MEMORY
              </p>
              <p className="text-fog text-sm text-center max-w-[280px] leading-relaxed">
                Eight pairs, hidden. Flip two, remember all, clear the board in the fewest moves.
              </p>
              <ArcadeButton variant="primary" big onClick={restart}><IconRestart /> Play</ArcadeButton>
              <p className="text-[11px] text-fog/80 flex items-center gap-1.5">
                {isCoarse ? (
                  <>Move with the pad, tap the centre to flip a card</>
                ) : (
                  <>Arrows move · <span className="keycap">Enter</span> flip</>
                )}
              </p>
            </div>
          )}

          {phase === "win" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.88)] animate-rise p-4 overflow-y-auto">
              <p className="font-display text-lg sm:text-2xl text-gold" style={{ textShadow: "0 0 26px rgba(255,207,92,0.55)" }}>
                ALL PAIRS FOUND
              </p>
              <p className="text-fog text-sm -mt-1">
                {moves} moves{best > 0 && moves === best && moves > 0 ? " — new record!" : ""}
              </p>
              <div className="flex items-center gap-2">
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] font-display text-fog mb-1">MOVES</p>
                  <p className="font-display text-xs text-lime tabular-nums">{moves}</p>
                </div>
                <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                  <p className="text-[8px] font-display text-fog mb-1">BEST</p>
                  <p className="font-display text-xs text-gold tabular-nums">{best > 0 ? best : "—"}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <ArcadeButton variant="primary" big onClick={restart}><IconRestart /> Play Again</ArcadeButton>
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
            <DPad center onPress={() => flip(eng()?.cursorX ?? 0, eng()?.cursorY ?? 0)} label="Flip card">
              <IconQuestion />
            </DPad>
            <DPad onPress={() => move("right")} label="Right"><IconChevron rotate={90} /></DPad>
            <span />
            <DPad onPress={() => move("down")} label="Down"><IconChevron rotate={180} /></DPad>
            <span />
          </div>
          <div className="flex flex-col gap-1.5">
            <DPad wide onPress={onExit} label="Back to games"><IconHome /></DPad>
            <DPad wide onPress={onMute} label="Toggle sound"><IconSound muted={muted} /></DPad>
          </div>
        </div>
      ) : (
        <div className="shrink-0 pb-2 sm:pb-3 text-center">
          <p className="text-[11px] text-fog/85 flex items-center justify-center gap-x-2 gap-y-1 flex-wrap">
            <span className="keycap">↑</span><span className="keycap">↓</span><span className="keycap">←</span><span className="keycap">→</span> move ·
            <span className="keycap">Enter</span> flip · <span className="keycap">R</span> restart ·
            <span className="keycap">F</span> fullscreen
          </p>
          <p className="font-display text-[7px] text-fog/50 tracking-[0.3em] mt-1.5 uppercase">
            Flip · Match · Recall
          </p>
        </div>
      )}

      <LeaderboardModal
        open={lbOpen}
        onClose={() => setLbOpen(false)}
        difficulty="memory"
        label="4X4 MATCH"
        labelColor="#a3f55a"
        ascending
        myScore={phase === "win" ? moves : 0}
      />
    </main>
  );
}

export const memory: GameDef = {
  id: "memory",
  name: "MEMORY",
  tagline: "Flip · Match · Recall",
  accent: "text-lime",
  icon: <IconMemory />,
  readBest: readBest,
  render: ({ onFullscreen, ...rest }) => <MemoryGame toggleFullscreen={onFullscreen} {...rest} />,
};