import type { DirName } from "./engine";

export type SweepPhase = "idle" | "playing" | "over" | "win";

export interface MineCell {
  mine: boolean;
  revealed: boolean;
  flag: boolean;
  adj: number;
  boom: boolean;
}

export const MSIZE = 9;
export const MINES = 10;

function idx(x: number, y: number): number {
  return y * MSIZE + x;
}

const NEIGHBORS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

export class Sweeper {
  grid: MineCell[] = [];
  cursorX = 0;
  cursorY = 0;
  phase: SweepPhase = "idle";
  private minesPlaced = false;
  private startedAt: number | null = null;
  private finalAt: number | null = null;

  constructor() {
    this.reset();
  }

  reset() {
    this.grid = new Array(MSIZE * MSIZE).fill(null).map(() => ({
      mine: false,
      revealed: false,
      flag: false,
      adj: 0,
      boom: false,
    }));
    this.cursorX = Math.floor(MSIZE / 2);
    this.cursorY = Math.floor(MSIZE / 2);
    this.phase = "idle";
    this.minesPlaced = false;
    this.startedAt = null;
    this.finalAt = null;
  }

  start() {
    this.reset();
    // mines are placed lazily on the first reveal so the opening cell is safe
  }

  get revealedCount() {
    return this.grid.filter((c) => c.revealed).length;
  }

  get flagCount() {
    return this.grid.filter((c) => c.flag).length;
  }

  time(): number {
    const end = this.finalAt ?? (this.phase === "playing" ? performance.now() : null);
    if (end === null || this.startedAt === null) return 0;
    return Math.max(0, end - this.startedAt);
  }

  private placeMines(safeIx: number) {
    let candidate = this.grid.map((_, i) => i);
    const safe = new Set([safeIx]);
    for (const [dx, dy] of NEIGHBORS) {
      const cx = safeIx % MSIZE;
      const cy = Math.floor(safeIx / MSIZE);
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < MSIZE && ny >= 0 && ny < MSIZE) safe.add(nx + ny * MSIZE);
    }
    candidate = candidate.filter((i) => !safe.has(i));
    for (let i = candidate.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
    }
    for (let k = 0; k < Math.min(MINES, candidate.length); k++) {
      this.grid[candidate[k]].mine = true;
    }
    for (let y = 0; y < MSIZE; y++) {
      for (let x = 0; x < MSIZE; x++) {
        let n = 0;
        for (const [dx, dy] of NEIGHBORS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < MSIZE && ny >= 0 && ny < MSIZE && this.grid[nx + ny * MSIZE].mine) n++;
        }
        this.grid[x + y * MSIZE].adj = n;
      }
    }
    this.minesPlaced = true;
  }

  moveCursor(d: DirName) {
    if (this.phase === "over" || this.phase === "win") return;
    if (d === "up" && this.cursorY > 0) this.cursorY -= 1;
    else if (d === "down" && this.cursorY < MSIZE - 1) this.cursorY += 1;
    else if (d === "left" && this.cursorX > 0) this.cursorX -= 1;
    else if (d === "right" && this.cursorX < MSIZE - 1) this.cursorX += 1;
  }

  reveal(x: number, y: number) {
    if (this.phase === "over" || this.phase === "win") return;
    const i = idx(x, y);
    const c = this.grid[i];
    if (c.revealed || c.flag) return;

    if (!this.minesPlaced) {
      this.placeMines(i);
      this.phase = "playing";
      this.startedAt = performance.now();
    }

    if (c.mine) {
      c.revealed = true;
      c.boom = true;
      for (const t of this.grid) if (t.mine) t.revealed = true;
      this.phase = "over";
      this.finalAt = performance.now();
      return;
    }

    this.flood(x, y);
    if (this.revealedCount === MSIZE * MSIZE - MINES) {
      this.phase = "win";
      this.finalAt = performance.now();
    }
  }

  private flood(x: number, y: number) {
    const stack: number[] = [idx(x, y)];
    while (stack.length > 0) {
      const i = stack.pop()!;
      const c = this.grid[i];
      if (c.revealed || c.mine || c.flag) continue;
      c.revealed = true;
      if (c.adj === 0) {
        const cx = i % MSIZE;
        const cy = Math.floor(i / MSIZE);
        for (const [dx, dy] of NEIGHBORS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < MSIZE && ny >= 0 && ny < MSIZE) stack.push(nx + ny * MSIZE);
        }
      }
    }
  }

  toggleFlag(x: number, y: number) {
    if (this.phase === "over" || this.phase === "win") return;
    const c = this.grid[idx(x, y)];
    if (c.revealed) return;
    c.flag = !c.flag;
  }
}