import { useCallback, useEffect, useRef, useState } from "react";
import {
  DIFFICULTIES,
  SnakeEngine,
  type DifficultyId,
  type DirName,
  type HudState,
} from "./game/engine";
import { sfx } from "./game/audio";

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

/* ---------- inline icons ---------- */
const ic = "w-4 h-4";
const IconPlay = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M4 2.5v11l9-5.5-9-5.5z" />
  </svg>
);
const IconPause = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <rect x="3.5" y="2.5" width="3.4" height="11" rx="1" />
    <rect x="9.1" y="2.5" width="3.4" height="11" rx="1" />
  </svg>
);
const IconRestart = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
    <path d="M13.7 1.8v3h-3" strokeLinejoin="round" />
  </svg>
);
const IconHome = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2.5 7.5 8 2.5l5.5 5v6h-4v-4h-3v4h-4v-6z" />
  </svg>
);
const IconSound = ({ muted }: { muted: boolean }) => (
  <svg className={ic} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2.5 6v4h2.5L8.5 13V3L5 6H2.5z" fill="currentColor" stroke="none" />
    {muted ? (
      <>
        <path d="M10.5 6.5 14 10" />
        <path d="M14 6.5 10.5 10" />
      </>
    ) : (
      <>
        <path d="M10.5 5.5a3.5 3.5 0 0 1 0 5" />
        <path d="M12.3 3.8a6 6 0 0 1 0 8.4" />
      </>
    )}
  </svg>
);
const IconCrown = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M2 5.5 4.8 8 8 3.5 11.2 8 14 5.5 12.8 12h-9.6L2 5.5z" />
    <rect x="3.2" y="12.6" width="9.6" height="1.6" rx="0.5" />
  </svg>
);
const IconChevron = ({ rotate }: { rotate: number }) => (
  <svg className="w-6 h-6" style={{ transform: `rotate(${rotate}deg)` }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m6 14 6-6 6 6" />
  </svg>
);

const LogoMark = ({ size = 38 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="shrink-0">
    <defs>
      <linearGradient id="serp" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#0f7a4d" />
        <stop offset="0.55" stopColor="#3ddc84" />
        <stop offset="1" stopColor="#c8ff70" />
      </linearGradient>
    </defs>
    <path
      d="M32 27c0 5-5 5-12 5S8 32 8 27s5-5 12-5 12 0 12-5-5-5-12-5"
      fill="none"
      stroke="url(#serp)"
      strokeWidth="5"
      strokeLinecap="round"
      strokeDasharray="9 7"
      className="animate-dashmove"
    />
    <circle cx="8" cy="12" r="4.4" fill="#c8ff70" />
    <circle cx="9.6" cy="10.8" r="1.1" fill="#0a1c14" />
    <path d="M3.8 12h-2m2 0 1.2-1.2M3.8 12l1.2 1.2" stroke="#ff6257" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

/* ---------- building blocks ---------- */

function ArcadeButton({
  children,
  onClick,
  variant = "ghost",
  big = false,
  disabled = false,
  title,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost" | "gold" | "coral";
  big?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-lime text-ink border-[#557f22] hover:bg-[#baff75]",
    gold: "bg-gold text-ink border-[#96700f] hover:bg-[#ffe08f]",
    coral: "bg-coral text-ink border-[#8f231c] hover:bg-[#ff8478]",
    ghost: "bg-moss text-foam border-[#08150e] hover:bg-fern",
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={() => {
        sfx.unlock();
        sfx.click();
        onClick();
      }}
      className={`
        font-display uppercase inline-flex items-center justify-center gap-2 select-none
        ${big ? "text-[11px] px-6 py-4" : "text-[9px] px-3.5 py-2.5"}
        rounded-md border-b-4 transition-all duration-100 active:translate-y-[3px] active:border-b-0
        disabled:opacity-35 disabled:pointer-events-none cursor-pointer
        ${styles[variant]} ${className}
      `}
    >
      {children}
    </button>
  );
}

function IconBtn({
  onClick,
  title,
  disabled = false,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={() => {
        sfx.unlock();
        sfx.click();
        onClick();
      }}
      className="w-10 h-10 grid place-items-center rounded-md bg-moss border border-line border-b-4 border-b-[#08150e]
        text-mint hover:bg-fern hover:text-lime active:translate-y-[2px] active:border-b transition-all duration-100
        disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
    >
      {children}
    </button>
  );
}

function Stat({ label, children, accent }: { label: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center gap-2 bg-pit/90 border border-line rounded-md px-3 py-2 min-w-0">
      <span className="font-display text-[8px] text-fog tracking-wider">{label}</span>
      <span className={`font-display text-sm sm:text-base tabular-nums ${accent ?? "text-foam"}`}>{children}</span>
    </div>
  );
}

/* ---------- app ---------- */

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SnakeEngine | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const mutedRef = useRef(false);

  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [boardSize, setBoardSize] = useState(320);
  const [muted, setMutedState] = useState(() => {
    try {
      const m = localStorage.getItem("serpentine.muted") === "1";
      mutedRef.current = m;
      sfx.muted = m;
      return m;
    } catch {
      return false;
    }
  });
  const [isCoarse] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
  );

  const applyMute = useCallback((v: boolean) => {
    mutedRef.current = v;
    sfx.muted = v;
    setMutedState(v);
    try {
      localStorage.setItem("serpentine.muted", v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  /* engine + sizing */
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const eng = new SnakeEngine(canvas, setHud);
    engineRef.current = eng;
    const ro = new ResizeObserver(() => {
      const r = container.getBoundingClientRect();
      const s = Math.max(240, Math.floor(Math.min(r.width, r.height)));
      setBoardSize(s);
      eng.resize(s, s, window.devicePixelRatio || 1);
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      eng.destroy();
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
      const eng = engineRef.current;
      if (!eng) return;
      sfx.unlock();
      const lower = e.key.toLowerCase();
      if (dirMap[lower]) {
        e.preventDefault();
        eng.setDirection(dirMap[lower]);
        return;
      }
      const ph = eng.getPhase();
      if (e.key === " ") {
        e.preventDefault();
        if (ph === "menu" || ph === "over") eng.start();
        else eng.togglePause();
        return;
      }
      if (e.key === "Enter") {
        if (ph === "menu" || ph === "over") eng.start();
        else if (ph === "paused") eng.togglePause();
        return;
      }
      if (lower === "p") return eng.togglePause();
      if (lower === "r") return ph !== "menu" ? eng.restart() : undefined;
      if (lower === "m") {
        applyMute(!mutedRef.current);
        return;
      }
      if (e.key === "Escape") return ph !== "menu" ? eng.toMenu() : undefined;
      if (ph === "menu" && ["1", "2", "3"].includes(e.key)) {
        eng.setDifficulty(DIFFICULTIES[Number(e.key) - 1].id);
        sfx.select();
      }
    };
    const onVis = () => {
      if (document.hidden) engineRef.current?.pauseIfPlaying();
    };
    const onBlur = () => engineRef.current?.pauseIfPlaying();
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, [applyMute]);

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
    const eng = engineRef.current;
    if (!eng) return;
    if (Math.abs(dx) > Math.abs(dy)) eng.setDirection(dx > 0 ? "right" : "left");
    else eng.setDirection(dy > 0 ? "down" : "up");
  };

  const eng = () => engineRef.current;
  const inRun = hud.phase === "playing" || hud.phase === "ready" || hud.phase === "paused";
  const diffDef = DIFFICULTIES.find((d) => d.id === hud.difficulty) ?? DIFFICULTIES[1];

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
      <header className="relative z-10 flex items-center justify-between px-3 sm:px-6 h-14 sm:h-16 shrink-0 border-b border-line/60 bg-pit/60">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <LogoMark />
          <div className="leading-none min-w-0">
            <h1
              className="font-display text-[13px] sm:text-base text-lime truncate"
              style={{ textShadow: "0 0 18px rgba(163,245,90,0.45), 2px 2px 0 rgba(15,122,77,0.9)" }}
            >
              SERPENTINE
            </h1>
            <p className="text-[10px] sm:text-[11px] text-fog tracking-[0.28em] mt-1 uppercase truncate">
              Arcade Snake
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 bg-moss/70 border border-line rounded-md px-3 py-1.5">
            <span className="text-gold"><IconCrown /></span>
            <span className="font-display text-[10px] text-gold tabular-nums">{hud.best}</span>
          </div>
          <IconBtn title={muted ? "Unmute (M)" : "Mute (M)"} onClick={() => applyMute(!muted)}>
            <IconSound muted={muted} />
          </IconBtn>
        </div>
      </header>

      {/* main column */}
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
            <span className="font-display text-[8px] tracking-wider" style={{ color: diffDef.color }}>
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
            {/* corner screws */}
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
                  <p className="text-fog text-xs mt-2 tracking-[0.3em] uppercase">get set…</p>
                </div>
              </div>
            )}

            {/* PAUSE overlay */}
            {hud.phase === "paused" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 sm:gap-5 bg-[rgba(3,10,6,0.86)] animate-rise p-4">
                <p className="font-display text-lg sm:text-xl text-mint" style={{ textShadow: "0 0 20px rgba(61,220,132,0.5)" }}>
                  PAUSED
                </p>
                <p className="text-fog text-sm -mt-2">The serpent waits in the grass…</p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <ArcadeButton variant="primary" onClick={() => eng()?.togglePause()}>
                    <IconPlay /> Resume
                  </ArcadeButton>
                  <ArcadeButton onClick={() => eng()?.restart()}>
                    <IconRestart /> Restart
                  </ArcadeButton>
                  <ArcadeButton onClick={() => eng()?.toMenu()}>
                    <IconHome /> Quit
                  </ArcadeButton>
                </div>
                <p className="text-[11px] text-fog/80 flex items-center gap-1.5">
                  <span className="keycap">P</span> to resume
                </p>
              </div>
            )}

            {/* MENU overlay */}
            {hud.phase === "menu" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.88)] animate-rise p-4 overflow-y-auto">
                <p className="font-display text-[9px] text-gold tracking-widest animate-blink">— INSERT COIN —</p>
                <div className="w-full max-w-[300px]">
                  <p className="font-display text-[9px] text-fog text-center mb-2 tracking-wider">SELECT DIFFICULTY</p>
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
                              <span className="font-display text-[10px]" style={{ color: d.color }}>
                                {d.label}
                              </span>
                              <span className="hidden sm:inline text-[9px] text-fog/70 font-bold">{i + 1}</span>
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
                            <span className="block text-[11px] text-fog truncate mt-0.5">{d.tagline}</span>
                          </span>
                          <span className="text-right shrink-0">
                            <span className="block text-[8px] font-display text-fog/70">BEST</span>
                            <span className="block font-display text-[10px] text-gold tabular-nums">
                              {active ? hud.best : readBest(d.id)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <ArcadeButton variant="primary" big onClick={() => eng()?.start()}>
                  <IconPlay /> Start Run
                </ArcadeButton>
                <p className="text-[11px] text-fog/85 text-center leading-relaxed">
                  {isCoarse ? (
                    <>Swipe the board or use the pad to steer</>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5 flex-wrap">
                      <span className="keycap">SPACE</span> start · <span className="keycap">↑↓←→</span> steer
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* GAME OVER overlay */}
            {hud.phase === "over" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[rgba(3,10,6,0.88)] animate-rise p-4 overflow-y-auto">
                <p
                  className={`font-display text-lg sm:text-2xl ${hud.win ? "text-gold" : "text-coral"}`}
                  style={{ textShadow: hud.win ? "0 0 26px rgba(255,207,92,0.55)" : "0 0 26px rgba(255,98,87,0.5)" }}
                >
                  {hud.win ? "BOARD CLEARED" : "GAME OVER"}
                </p>
                {hud.newBest ? (
                  <div className="flex items-center gap-2 bg-gold/15 border border-gold/60 rounded-md px-3 py-1.5 animate-crown">
                    <span className="text-gold"><IconCrown /></span>
                    <span className="font-display text-[9px] text-gold tracking-wider animate-blink">NEW HIGH SCORE</span>
                  </div>
                ) : (
                  <p className="text-fog text-sm -mt-1">
                    {hud.foods >= 15 ? "So close — the apple was right there." : "The garden claims another serpent."}
                  </p>
                )}
                <div className="text-center">
                  <p className="font-display text-[8px] text-fog tracking-widest mb-1.5">SCORE</p>
                  <p className="font-display text-3xl sm:text-4xl text-lime animate-pop" key={hud.score} style={{ textShadow: "0 0 30px rgba(163,245,90,0.4)" }}>
                    {hud.score}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-center">
                  <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                    <p className="text-[8px] font-display text-fog mb-1">BEST</p>
                    <p className="font-display text-xs text-gold tabular-nums">{hud.best}</p>
                  </div>
                  <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                    <p className="text-[8px] font-display text-fog mb-1">LENGTH</p>
                    <p className="font-display text-xs text-mint tabular-nums">{hud.length}</p>
                  </div>
                  <div className="bg-pit/80 border border-line rounded-md px-3 py-2">
                    <p className="text-[8px] font-display text-fog mb-1">APPLES</p>
                    <p className="font-display text-xs text-coral tabular-nums">{hud.foods}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <ArcadeButton variant="primary" big onClick={() => eng()?.start()}>
                    <IconRestart /> Play Again
                  </ArcadeButton>
                  <ArcadeButton onClick={() => eng()?.toMenu()}>
                    <IconHome /> Menu
                  </ArcadeButton>
                </div>
                {!isCoarse && (
                  <p className="text-[11px] text-fog/80 flex items-center gap-1.5">
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
              <DPad wide onPress={() => applyMute(!muted)} label="Toggle sound">
                <IconSound muted={muted} />
              </DPad>
            </div>
          </div>
        ) : (
          <div className="shrink-0 pb-2 sm:pb-3 text-center">
            <p className="text-[11px] text-fog/85 flex items-center justify-center gap-x-2 gap-y-1 flex-wrap">
              <span className="keycap">↑</span><span className="keycap">↓</span><span className="keycap">←</span><span className="keycap">→</span>
              <span className="text-fog/60">or</span>
              <span className="keycap">WASD</span> steer
              <span className="text-line">·</span>
              <span className="keycap">SPACE</span> pause
              <span className="text-line">·</span>
              <span className="keycap">R</span> restart
              <span className="text-line">·</span>
              <span className="keycap">M</span> sound
            </p>
            <p className="font-display text-[7px] text-fog/50 tracking-[0.3em] mt-1.5 uppercase">
              Eat · Grow · Survive
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function DPad({
  children,
  onPress,
  label,
  center = false,
  wide = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  center?: boolean;
  wide?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        sfx.unlock();
        if (!disabled) onPress();
      }}
      className={`
        grid place-items-center rounded-lg border border-line border-b-4 border-b-[#04100a]
        bg-gradient-to-b from-fern to-moss text-mint active:text-lime
        active:translate-y-[2px] active:border-b-2 transition-all duration-75 touch-none cursor-pointer
        disabled:opacity-35 disabled:pointer-events-none
        ${wide ? "w-16 h-[52px]" : "w-[52px] h-[52px]"}
        ${center ? "bg-gradient-to-b from-moss to-pit text-lime" : ""}
      `}
    >
      {children}
    </button>
  );
}
