import type { DirName } from "./engine";

export type MemPhase = "idle" | "playing" | "win";

export interface MemCell {
  value: number;
  face: boolean;
  matched: boolean;
}

export const MROW = 4;
export const MCOL = 4;
export const SYMBOLS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function idx(x: number, y: number): number {
  return y * MCOL + x;
}

function shuffled(): number[] {
  const deck: number[] = [];
  SYMBOLS.forEach((_, k) => deck.push(k, k));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export class Memory {
  grid: MemCell[] = [];
  cursorX = 0;
  cursorY = 0;
  phase: MemPhase = "idle";
  moves = 0;
  pending = false; // two unmatched cards shown, waiting to close

  constructor() {
    this.start();
  }

  start() {
    const deck = shuffled();
    this.grid = deck.map((value) => ({ value, face: false, matched: false }));
    this.cursorX = 0;
    this.cursorY = 0;
    this.phase = "idle";
    this.moves = 0;
    this.pending = false;
  }

  get matchedCount() {
    return this.grid.filter((c) => c.matched).length;
  }

  get faceCount() {
    return this.grid.filter((c) => c.face && !c.matched).length;
  }

  moveCursor(d: DirName) {
    if (this.phase === "win" || this.pending) return;
    if (d === "up" && this.cursorY > 0) this.cursorY -= 1;
    else if (d === "down" && this.cursorY < MROW - 1) this.cursorY += 1;
    else if (d === "left" && this.cursorX > 0) this.cursorX -= 1;
    else if (d === "right" && this.cursorX < MCOL - 1) this.cursorX += 1;
  }

  /** Returns "match" | "set" | "await" | null. Null = nothing changed. */
  flip(x: number, y: number): { type: "match" | "set" | "await" } | null {
    if (this.phase === "win" || this.pending) return null;
    const i = idx(x, y);
    const c = this.grid[i];
    if (c.face || c.matched) return null;

    if (this.phase === "idle") this.phase = "playing";
    c.face = true;

    if (this.faceCount === 2) this.moves += 1;

    const faceIdx = this.grid.map((t, k) => (t.face && !t.matched ? k : -1)).filter((k) => k >= 0);
    if (faceIdx.length === 2) {
      const [a, b] = faceIdx;
      if (this.grid[a].value === this.grid[b].value) {
        this.grid[a].matched = true;
        this.grid[b].matched = true;
        this.grid[a].face = false;
        this.grid[b].face = false;
        if (this.matchedCount === MROW * MCOL) this.phase = "win";
        return { type: "match" };
      }
      this.pending = true;
      return { type: "await" };
    }
    return { type: "set" };
  }

  /** Shell calls this after the mismatch reveal timeout. */
  closeMismatch() {
    if (!this.pending) return;
    this.pending = false;
    for (const c of this.grid) {
      if (c.face && !c.matched) c.face = false;
    }
  }
}