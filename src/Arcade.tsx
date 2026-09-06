import { useEffect, useState } from "react";
import { sfx } from "./game/audio";
import { GAMES, type GameDef } from "./games";
import { IconBtn } from "./ui/controls";
import { IconChevron, IconMinimize, IconExpand, IconSound, LogoMark } from "./ui/icons";
import { useFullscreen } from "./ui/fullscreen";
import { useGamepad } from "./ui/input";

type GameId = GameDef["id"];

export default function Arcade() {
  const [gameId, setGameId] = useState<GameId | null>(null);
  const [sel, setSel] = useState(0);
  const { isFs, toggle } = useFullscreen();
  const [muted, setMutedState] = useState(() => {
    try {
      return localStorage.getItem("serpentine.muted") === "1";
    } catch {
      return false;
    }
  });

  const active = gameId ? GAMES.find((g) => g.id === gameId) : undefined;

  useEffect(() => {
    sfx.muted = muted;
    try {
      localStorage.setItem("serpentine.muted", muted ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [muted]);

  const onMute = () => setMutedState((v) => !v);

  const play = (id: GameId) => {
    sfx.unlock();
    sfx.select();
    setGameId(id);
    setSel(0);
  };

  /* hub navigation */
  useEffect(() => {
    if (gameId !== null) return;
    const onKey = (e: KeyboardEvent) => {
      sfx.unlock();
      const lower = e.key.toLowerCase();
      if (lower === "m") return onMute();
      if (lower === "f") return toggle();
      if (["arrowdown", "arrowup", "s", "w"].includes(lower)) {
        e.preventDefault();
        setSel((s) => (s + 1) % GAMES.length);
        sfx.select();
        return;
      }
      if (e.key === "Enter" || e.key === " " || lower === "1") {
        e.preventDefault();
        play(GAMES[sel % GAMES.length].id);
        return;
      }
      if (lower === "2" && GAMES[1]) {
        e.preventDefault();
        play(GAMES[1].id);
        return;
      }
      if (lower === "3" && GAMES[2]) {
        e.preventDefault();
        play(GAMES[2].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, sel]);

  useGamepad({
    onDir: (d) => {
      if (gameId !== null) return;
      if (d === "up" || d === "down") {
        setSel((s) => (s + 1) % GAMES.length);
        sfx.select();
      }
    },
    onPrimary: () => gameId === null && play(GAMES[sel % GAMES.length].id),
    onStart: () => gameId === null && play(GAMES[sel % GAMES.length].id),
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
              {active ? `${active.name} — ${active.tagline}` : `${GAMES.length} games · Works offline`}
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

      {active ? (
        active.render({ muted, onMute, onExit: () => setGameId(null), onFullscreen: toggle })
      ) : (
        <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center gap-5 sm:gap-6 px-4 py-6 overflow-y-auto">
          <div className="text-center">
            <p className="font-display text-[9px] text-gold tracking-widest animate-blink">— INSERT COIN —</p>
            <h2 className="font-display text-lg sm:text-2xl text-foam mt-3" style={{ textShadow: "0 0 24px rgba(61,220,132,0.35)" }}>
              SELECT A GAME
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full max-w-[820px]">
            {GAMES.map((g, i) => {
              const isActive = sel === i;
              const best = g.readBest?.() ?? 0;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => play(g.id)}
                  onMouseEnter={() => setSel(i)}
                  className={`group relative rounded-lg border-2 bg-pit/85 p-5 sm:p-6 text-left transition-all duration-150 cursor-pointer
                    ${isActive ? "bg-moss/70" : "hover:bg-moss/40"}`}
                  style={{
                    borderColor: isActive ? (g.id === "serpentine" ? "#a3f55a" : g.id === "blocktwist" ? "#ffcf5c" : "#ff6257") : "rgba(39,148,104,0.5)",
                    boxShadow: isActive ? `0 0 26px ${g.id === "serpentine" ? "rgba(163,245,90,0.22)" : g.id === "blocktwist" ? "rgba(255,207,92,0.22)" : "rgba(255,98,87,0.22)"}` : undefined,
                  }}
                >
                  {isActive && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-lime animate-blink" />
                  )}
                  <span className={`w-10 h-10 grid place-items-center rounded-md bg-moss border border-line mb-3 ${g.accent}`}>
                    {g.icon}
                  </span>
                  <span className="block">
                    <span className={`font-display text-[13px] ${g.accent}`}>{g.name}</span>
                    <span className="block text-[11px] text-fog mt-1.5">{g.tagline}</span>
                    <span className="flex items-center justify-between mt-4">
                      {g.readBest ? (
                        <span className="inline-flex items-center gap-1.5 text-gold">
                          <span className="text-[8px] font-display text-fog/70">BEST</span>
                          <span className="font-display text-[11px] tabular-nums">{best}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-gold">
                          <span className="text-[8px] font-display text-fog/70">COIN-OP</span>
                          <span className="font-display text-[9px]">FREE PLAY</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 font-display text-[9px] text-lime group-hover:gap-2 transition-all">
                        PLAY <IconChevron rotate={-90} />
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-fog/75 text-center leading-relaxed max-w-[520px]">
            Arrows <span className="keycap">↑</span><span className="keycap">↓</span> + <span className="keycap">1</span>–{GAMES.length.toString()}{" "}
            to pick · <span className="keycap">ENTER</span> to play · works offline, with controllers, no account needed
          </p>
        </main>
      )}
    </div>
  );
}