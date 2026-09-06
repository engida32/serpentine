export interface TrophyDef {
  id: string;
  game: string;
  name: string;
  hint: string;
}

export const TROPHIES: TrophyDef[] = [
  { id: "snake.500", game: "serpentine", name: "Serpent Tamer", hint: "Score 500 in one run" },
  { id: "snake.board", game: "serpentine", name: "Garden Purged", hint: "Clear the whole board" },
  { id: "snake.feast", game: "serpentine", name: "Apple Hoarder", hint: "Eat 15 apples in one run" },
  { id: "block.2048", game: "blocktwist", name: "Treasure Found", hint: "Reach the 2048 tile" },
  { id: "block.4096", game: "blocktwist", name: "Gold Hoard", hint: "Reach the 4096 tile" },
  { id: "block.marathon", game: "blocktwist", name: "Marathon", hint: "Make 100 moves in one game" },
  { id: "breakout.wall", game: "breakout", name: "Wrecking Ball", hint: "Clear the wall" },
  { id: "breakout.flawless", game: "breakout", name: "Flawless", hint: "Clear the wall without losing a ball" },
  { id: "breakout.500", game: "breakout", name: "High Roller", hint: "Score 500" },
  { id: "invaders.planet", game: "invaders", name: "Planet's Shield", hint: "Defend the planet" },
  { id: "invaders.10k", game: "invaders", name: "Fleet Annihilator", hint: "Score 10,000" },
  { id: "pong.win", game: "pong", name: "Ghostbuster", hint: "Beat the Ghost at rally-to-7" },
  { id: "pong.streak5", game: "pong", name: "Unstoppable", hint: "Win 5 games in a row" },
  { id: "asteroids.25", game: "asteroids", name: "Rock Breaker", hint: "Destroy 25 rocks in one run" },
  { id: "asteroids.75", game: "asteroids", name: "Debris Field", hint: "Destroy 75 rocks in one run" },
  { id: "sweeper.clear", game: "sweeper", name: "Dust Off", hint: "Clear the minefield" },
  { id: "sweeper.swift", game: "sweeper", name: "Speed Sweeper", hint: "Clear the field in under 30 seconds" },
  { id: "sweeper.noflags", game: "sweeper", name: "Bare Hands", hint: "Clear the field without placing a flag" },
  { id: "memory.perfect", game: "memory", name: "Perfect Memory", hint: "Clear the pair board in 8 moves" },
  { id: "memory.ninja", game: "memory", name: "Fast Recall", hint: "Clear the pair board in 12 moves or fewer" },
];

const TROPHY_KEY = "serpentine.trophies";
const PLAYED_KEY = "serpentine.played";
const POINTS_KEY = "serpentine.points";

function readArr(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeArr(key: string, arr: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    /* storage unavailable */
  }
}

function readNum(key: string): number {
  try {
    const n = Number(localStorage.getItem(key) ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeNum(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* storage unavailable */
  }
}

export function unlockedTrophies(): string[] {
  return readArr(TROPHY_KEY);
}

/** Returns true when the trophy was unlocked for the first time just now. */
export function unlockTrophy(id: string): boolean {
  if (!TROPHIES.some((t) => t.id === id)) return false;
  const cur = readArr(TROPHY_KEY);
  if (cur.includes(id)) return false;
  cur.push(id);
  writeArr(TROPHY_KEY, cur);
  return true;
}

export function trophyCount(): number {
  return readArr(TROPHY_KEY).length;
}

export function trophiesForGame(game: string): { total: number; unlocked: string[] } {
  const defs = TROPHIES.filter((t) => t.game === game);
  const have = new Set(readArr(TROPHY_KEY));
  return { total: defs.length, unlocked: defs.filter((t) => have.has(t.id)).map((t) => t.id) };
}

export function gamesPlayed(): number {
  return readNum(PLAYED_KEY);
}

export function totalPoints(): number {
  return readNum(POINTS_KEY);
}

export function recordPlay(points: number): void {
  writeNum(PLAYED_KEY, gamesPlayed() + 1);
  if (points > 0) {
    writeNum(POINTS_KEY, totalPoints() + Math.round(points));
  }
}

/** ISO-8601 week id, e.g. "2026-W36", used for the weekly leaderboard tab. */
export function weekId(d = new Date()): string {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}