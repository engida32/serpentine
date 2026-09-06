import type { DirName } from "./engine";

export const BSIZE = 4;
export const GTILE = 2048;

export type BlockPhase = "playing" | "over";

export interface BTile {
  id: number;
  v: number;
}

export interface MoveResult {
  moved: boolean;
  gain: number;
  merged: number[]; // final indices that were produced by a merge
  spawned: number | null; // index of the new tile, if any
}

let nextId = 1;

function idx(x: number, y: number): number {
  return y * BSIZE + x;
}

/** Returns indices ordered from the sliding edge (front) to the back. */
function lineIndices(dir: DirName, n: number): number[] {
  switch (dir) {
    case "left":
      return [n * BSIZE, n * BSIZE + 1, n * BSIZE + 2, n * BSIZE + 3];
    case "right":
      return [n * BSIZE + 3, n * BSIZE + 2, n * BSIZE + 1, n * BSIZE];
    case "up":
      return [n, n + BSIZE, n + BSIZE * 2, n + BSIZE * 3];
    case "down":
      return [n + BSIZE * 3, n + BSIZE * 2, n + BSIZE, n];
  }
}

export class Blocks {
  grid: (BTile | null)[] = new Array(BSIZE * BSIZE).fill(null);
  score = 0;
  phase: BlockPhase = "playing";
  won = false;
  moves = 0;
  best = 0;

  constructor() {
    this.spawn();
    this.spawn();
  }

  reset() {
    this.grid = new Array(BSIZE * BSIZE).fill(null);
    this.score = 0;
    this.phase = "playing";
    this.won = false;
    this.moves = 0;
    this.spawn();
    this.spawn();
  }

  get tiles(): BTile[] {
    return this.grid.filter((t): t is BTile => t !== null);
  }

  private emptyCells(): number[] {
    const out: number[] = [];
    this.grid.forEach((t, i) => {
      if (t === null) out.push(i);
    });
    return out;
  }

  spawn(): number | null {
    const empties = this.emptyCells();
    if (empties.length === 0) return null;
    const ix = empties[Math.floor(Math.random() * empties.length)];
    this.grid[ix] = { id: nextId++, v: Math.random() < 0.9 ? 2 : 4 };
    return ix;
  }

  private hasMerge(): boolean {
    for (let y = 0; y < BSIZE; y++) {
      for (let x = 0; x < BSIZE; x++) {
        const t = this.grid[idx(x, y)];
        if (!t) continue;
        if (x < BSIZE - 1) {
          const r = this.grid[idx(x + 1, y)];
          if (r && r.v === t.v) return true;
        }
        if (y < BSIZE - 1) {
          const d = this.grid[idx(x, y + 1)];
          if (d && d.v === t.v) return true;
        }
      }
    }
    return false;
  }

  isOver(): boolean {
    return this.emptyCells().length === 0 && !this.hasMerge();
  }

  move(dir: DirName): MoveResult {
    if (this.phase === "over") return { moved: false, gain: 0, merged: [], spawned: null };
    let moved = false;
    let gain = 0;
    const merged: number[] = [];
    const hold: Record<number, number> = {};
    this.grid.forEach((t, i) => {
      if (t) hold[t.id] = i;
    });

    for (let n = 0; n < BSIZE; n++) {
      const indices = lineIndices(dir, n);
      const nums = indices
        .map((i) => this.grid[i])
        .filter((t): t is BTile => t !== null);
      const res: BTile[] = [];
      const blocked: boolean[] = [];

      for (const t of nums) {
        const lastI = res.length - 1;
        if (lastI >= 0 && !blocked[lastI] && res[lastI].v === t.v) {
          res[lastI] = { id: nextId++, v: res[lastI].v * 2 };
          blocked[lastI] = true;
          gain += res[lastI].v;
          merged.push(indices[lastI]);
          const old = hold[res[lastI].id];
          if (old !== indices[lastI]) moved = true;
        } else {
          res.push(t);
          blocked.push(false);
          const newI = res.length - 1;
          if (hold[t.id] !== indices[newI]) moved = true;
        }
      }

      for (let k = 0; k < BSIZE; k++) this.grid[indices[k]] = res[k] ?? null;
    }

    if (!moved) return { moved: false, gain: 0, merged: [], spawned: null };

    this.moves += 1;
    this.score += gain;
    const spawned = this.spawn();
    if (this.grid.some((t) => t && t.v >= GTILE)) this.won = true;
    if (this.tiles.length >= BSIZE * BSIZE && this.hasMerge()) {
      /* still playable */
    } else if (this.isOver()) {
      this.phase = "over";
      if (this.score > this.best) this.best = this.score;
    }
    return { moved: true, gain, merged, spawned };
  }
}