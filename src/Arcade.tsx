import { useEffect, useState } from "react";
import { DIFFICULTIES } from "./game/engine";
import { sfx } from "./game/audio";
import { SnakeGame } from "./SnakeGame";
import { BlockGame } from "./BlockGame";
import { IconBtn } from "./ui/controls";
import { IconChevron, IconGrid, IconMinimize, IconExpand, IconSnake, IconSound, LogoMark } from "./ui/icons";
import { useFullscreen } from "./ui/fullscreen";
import { useGamepad } from "./ui/input";

export type GameId = "hub" | "snake" | "blocks";

function readSnakeBest(): number {
  let max = 0;
  for (const d of DIFFICULTIES) {
    try {
      max = Math.max(max, Number(localStorage.getItem(`serpentine.best.${d.id}`) ?? 0) || 0);
    } catch {
      /* ignore */
    }
  }
  return max;
}

function readBlocksBest(): number {
  try {
    return Number(localStorage.getItem("serpentine.2048.best") ?? 0) || 0;
  } catch {
    return 0;
  }
}

export default function Arcade() {
  const [game, setGame] = useState<GameId>("hub");
  const [sel, setSel] = useState<0 | 1>(0);
  const { isFs, toggle } = useFullscreen();
  const [muted, setMutedState] = useState(() => {
    try {
      return localStorage.getItem("serpentine.muted") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    sfx.muted = muted;
    try {
      localStorage.setItem("serpentine.muted", muted ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [muted]);

  const onMute = () => setMutedState((v) => !v);

  const play = (g: GameId) => {
    if (g === "hub") return;
    sfx.unlock();
    sfx.select();
    setGame(g);
  };

  /* hub navigation */
  useEffect(() => {
    if (game !== "hub") return;
    const onKey = (e: KeyboardEvent) => {
      sfx.unlock();
      const lower = e.key.toLowerCase();
      if (lower === "m") return onMute();
      if (lower === "f") return toggle();
      if (["arrowdown", "arrowup", "s", "w"].includes(lower)) {
        e.preventDefault();
        setSel((s) => (s === 0 ? 1 : 0));
        sfx.select();
        return;
      }
      if (e.key === "Enter" || e.key === " " || lower === "1") {
        e.preventDefault();
        play(sel === 0 ? "snake" : "blocks");
        return;
      }
      if (lower === "2") {
        e.preventDefault();
        play("blocks");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, sel]);

  useGamepad({
    onDir: (d) => {
      if (game !== "hub") return;
      if (d === "up" || d === "down") {
        setSel((s) => (s === 0 ? 1 : 0));
        sfx.select();
      }
    },
    onPrimary: () => game === "hub" && play(sel === 0 ? "snake" : "blocks"),
    onStart: () => game === "hub" && play(sel === 0 ? "snake" : "blocks"),
  });

  const games = [
    {
      id: "snake" as const,
      icon: <IconSnake />,
      name: "SERPENTINE",
      tagline: "Eat · Grow · Survive",
      best: readSnakeBest(),
      accent: "text-lime",
      border: "border-lime/50",
      glow: "hover:shadow-[0_0_40px_rgba(163,245,90,0.25)]",
    },
    {
      id: "blocks" as const,
      icon: <IconGrid />,
      name: "BLOCK TWIST",
      tagline: "Slide · Merge · Reach 2048",
      best: readBlocksBest(),
      accent: "text-gold",
      border: "border-gold/50",
      glow: "hover:shadow-[0_0_40px_rgba(255,207,92,0.25)]",
    },
  ];

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
              SERPENTINE ARCADE
            </h1>
            <p className="text-[10px] sm:text-[11px] text-fog tracking-[0.28em] mt-1 uppercase truncate">
              {game === "snake" ? "Serpentine — Arcade Snake" : game === "blocks" ? "Block Twist — Slide & Merge" : "Two games · Works offline"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IconBtn title={isFs ? "Exit fullscreen (F)" : "Fullscreen (F)"} onClick={toggle}>
            {isFs ? <IconMinimize /> : <IconExpand />}
          </IconBtn>
          <IconBtn title={muted ? "Unmute (M)" : "Mute (M)"} onClick={onMute}>
            <IconSound muted={muted} />
          </IconBtn>
        </div>
      </header>

      {game === "snake" ? (
        <SnakeGame muted={muted} onMute={onMute} onExit={() => setGame("hub")} toggleFullscreen={toggle} />
      ) : game === "blocks" ? (
        <BlockGame muted={muted} onMute={onMute} onExit={() => setGame("hub")} toggleFullscreen={toggle} />
      ) : (
        <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center gap-5 sm:gap-6 px-4 py-6 overflow-y-auto">
          <div className="text-center">
            <p className="font-display text-[9px] text-gold tracking-widest animate-blink">— INSERT COIN —</p>
            <h2 className="font-display text-lg sm:text-2xl text-foam mt-3" style={{ textShadow: "0 0 24px rgba(61,220,132,0.35)" }}>
              SELECT A GAME
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-[620px]">
            {games.map((g, i) => {
              const active = sel === i;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => play(g.id)}
                  onMouseEnter={() => setSel(i as 0 | 1)}
                  className={`group relative rounded-lg border-2 bg-pit/85 p-5 sm:p-6 text-left transition-all duration-150 cursor-pointer
                    ${g.border} ${g.glow} ${active ? "bg-moss/70 shadow-[0_0_30px_rgba(0,0,0,0.4)]" : "hover:bg-moss/40"}`}
                  style={active ? { boxShadow: `0 0 26px ${g.id === "snake" ? "rgba(163,245,90,0.22)" : "rgba(255,207,92,0.22)"}` } : undefined}
                >
                  {active && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-lime animate-blink" />
                  )}
                  <span className={`w-10 h-10 grid place-items-center rounded-md bg-moss border border-line mb-3 ${g.accent}`}>
                    {g.icon}
                  </span>
                  <span className="block">
                    <span className={`font-display text-[13px] ${g.accent}`}>{g.name}</span>
                    <span className="block text-[11px] text-fog mt-1.5">{g.tagline}</span>
                    <span className="flex items-center justify-between mt-4">
                      <span className="inline-flex items-center gap-1.5 text-gold">
                        <span className="text-[8px] font-display text-fog/70">BEST</span>
                        <span className="font-display text-[11px] tabular-nums">{g.best}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 font-display text-[9px] text-lime group-hover:gap-2 transition-all">
                        PLAY <IconChevron rotate={-90} />
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-fog/75 text-center leading-relaxed max-w-[460px]">
            Arrows / <span className="keycap">1</span> / <span className="keycap">2</span> to choose ·{" "}
            <span className="keycap">ENTER</span> to play · works offline and with controllers
          </p>
        </main>
      )}
    </div>
  );
}