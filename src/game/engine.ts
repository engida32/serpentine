import { sfx } from "./audio";
import { prefersReducedMotion } from "./motion";

export const COLS = 21;
export const ROWS = 21;

export type Phase = "menu" | "ready" | "playing" | "paused" | "dying" | "over";
export type DifficultyId = "garden" | "arcade" | "viper";
export type DirName = "up" | "down" | "left" | "right";

export interface DifficultyDef {
  id: DifficultyId;
  label: string;
  tagline: string;
  base: number; // ms per step
  minMul: number; // fastest allowed, as multiplier of base
  pips: number;
  color: string;
}

export const DIFFICULTIES: DifficultyDef[] = [
  { id: "garden", label: "GARDEN", tagline: "A gentle crawl through the hedges", base: 168, minMul: 0.6, pips: 1, color: "#3ddc84" },
  { id: "arcade", label: "ARCADE", tagline: "The classic coin-op pace", base: 118, minMul: 0.56, pips: 2, color: "#a3f55a" },
  { id: "viper", label: "VIPER", tagline: "Strike speed. No mercy", base: 80, minMul: 0.52, pips: 3, color: "#ff6257" },
];

export interface HudState {
  phase: Phase;
  score: number;
  best: number;
  length: number;
  speed: number; // multiplier, e.g. 1.35
  foods: number;
  newBest: boolean;
  difficulty: DifficultyId;
  win: boolean;
}

interface Cell {
  x: number;
  y: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  grav: number;
}
interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}
interface Mote {
  x: number;
  y: number;
  r: number;
  sp: number;
  ph: number;
  gold: boolean;
}

const DIRS: Record<DirName, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<DirName, DirName> = { up: "down", down: "up", left: "right", right: "left" };
const BEST_KEY = (d: DifficultyId) => `serpentine.best.${d}`;

function loadBest(d: DifficultyId): number {
  try {
    return Number(localStorage.getItem(BEST_KEY(d)) ?? 0) || 0;
  } catch {
    return 0;
  }
}
function saveBest(d: DifficultyId, v: number) {
  try {
    localStorage.setItem(BEST_KEY(d), String(v));
  } catch {
    /* ignore */
  }
}

export class SnakeEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHud: (h: HudState) => void;
  private raf = 0;
  private last = 0;
  private cssW = 0;
  private cssH = 0;
  private destroyed = false;

  // game state
  private phase: Phase = "menu";
  private difficulty: DifficultyId = "arcade";
  private snake: Cell[] = [];
  private prevSnake: Cell[] = [];
  private dir: DirName = "right";
  private queue: DirName[] = [];
  private food: Cell = { x: 5, y: 5 };
  private bonus: (Cell & { ttl: number; max: number }) | null = null;
  private score = 0;
  private best = 0;
  private foods = 0;
  private newBest = false;
  private win = false;
  private acc = 0;
  private alpha = 0;
  private readyT = 0;
  private dyingT = 0;
  private shake = 0;
  private flash = 0;

  private particles: Particle[] = [];
  private floats: FloatText[] = [];
  private motes: Mote[] = [];

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudState) => void) {
    this.canvas = canvas;
    this.onHud = onHud;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.best = loadBest(this.difficulty);
    this.resetBoard();
    if (!prefersReducedMotion()) this.seedMotes();
    this.last = performance.now();
    const loop = (t: number) => {
      if (this.destroyed) return;
      const dt = Math.min(50, t - this.last);
      this.last = t;
      this.update(dt, t);
      this.render(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.emit();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.cssW = cssW;
    this.cssH = cssH;
    const d = Math.min(2, dpr || 1);
    this.canvas.width = Math.max(1, Math.round(cssW * d));
    this.canvas.height = Math.max(1, Math.round(cssH * d));
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  // ---------- public controls ----------

  setDifficulty(id: DifficultyId) {
    if (this.phase === "playing" || this.phase === "ready" || this.phase === "dying") return;
    this.difficulty = id;
    this.best = loadBest(id);
    this.emit();
  }

  getPhase() {
    return this.phase;
  }

  start() {
    if (this.phase === "playing" || this.phase === "ready" || this.phase === "dying") return;
    this.resetBoard();
    this.phase = "ready";
    this.readyT = 950;
    sfx.start();
    this.emit();
  }

  restart() {
    this.resetBoard();
    this.phase = "ready";
    this.readyT = 950;
    sfx.resume();
    this.emit();
  }

  togglePause() {
    if (this.phase === "playing") {
      this.phase = "paused";
      sfx.pause();
      this.emit();
    } else if (this.phase === "paused") {
      this.phase = "ready";
      this.readyT = 700;
      sfx.resume();
      this.emit();
    }
  }

  pauseIfPlaying() {
    if (this.phase === "playing") {
      this.phase = "paused";
      this.emit();
    }
  }

  toMenu() {
    if (this.score > this.best) {
      this.best = this.score;
      saveBest(this.difficulty, this.best);
    }
    this.phase = "menu";
    this.resetBoard();
    this.emit();
  }

  setDirection(name: DirName) {
    if (this.phase !== "playing" && this.phase !== "ready") return;
    const ref = this.queue.length > 0 ? this.queue[this.queue.length - 1] : this.dir;
    if (name === ref || name === OPPOSITE[ref]) return;
    if (this.queue.length < 3) this.queue.push(name);
  }

  // ---------- internals ----------

  private diff() {
    return DIFFICULTIES.find((d) => d.id === this.difficulty) ?? DIFFICULTIES[1];
  }

  private interval() {
    const d = this.diff();
    return d.base * Math.max(d.minMul, Math.pow(0.986, this.foods));
  }

  private resetBoard() {
    const cy = Math.floor(ROWS / 2);
    const cx = Math.floor(COLS / 2);
    this.snake = [
      { x: cx + 1, y: cy },
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    this.prevSnake = this.snake.map((c) => ({ ...c }));
    this.dir = "right";
    this.queue = [];
    this.score = 0;
    this.foods = 0;
    this.newBest = false;
    this.win = false;
    this.acc = 0;
    this.alpha = 0;
    this.shake = 0;
    this.flash = 0;
    this.bonus = null;
    this.particles = [];
    this.floats = [];
    this.spawnFood();
  }

  private seedMotes() {
    this.motes = Array.from({ length: 14 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1 + Math.random() * 2.2,
      sp: 0.008 + Math.random() * 0.02,
      ph: Math.random() * Math.PI * 2,
      gold: Math.random() < 0.3,
    }));
  }

  private emptyCells(excludeBonus = true): Cell[] {
    const occupied = new Set(this.snake.map((c) => `${c.x},${c.y}`));
    occupied.add(`${this.food.x},${this.food.y}`);
    if (excludeBonus && this.bonus) occupied.add(`${this.bonus.x},${this.bonus.y}`);
    const out: Cell[] = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) if (!occupied.has(`${x},${y}`)) out.push({ x, y });
    return out;
  }

  private spawnFood() {
    const cells = this.emptyCells();
    if (cells.length === 0) return;
    this.food = cells[Math.floor(Math.random() * cells.length)];
  }

  private spawnBonus() {
    const cells = this.emptyCells();
    if (cells.length < 8) return;
    const c = cells[Math.floor(Math.random() * cells.length)];
    this.bonus = { ...c, ttl: 6500, max: 6500 };
  }

  private emit() {
    this.onHud({
      phase: this.phase,
      score: this.score,
      best: this.best,
      length: this.snake.length,
      speed: this.diff().base / this.interval(),
      foods: this.foods,
      newBest: this.newBest,
      difficulty: this.difficulty,
      win: this.win,
    });
  }

  private cellPx() {
    return Math.min(this.cssW, this.cssH) / COLS;
  }

  private burst(cx: number, cy: number, colors: string[], count: number, power: number) {
    const cell = this.cellPx();
    const px = (cx + 0.5) * cell;
    const py = (cy + 0.5) * cell;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.4 + Math.random() * 0.6) * power * cell * 0.09;
      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - cell * 0.02,
        life: 0,
        maxLife: 420 + Math.random() * 380,
        size: cell * (0.06 + Math.random() * 0.09),
        color: colors[Math.floor(Math.random() * colors.length)],
        grav: cell * 0.00022,
      });
    }
  }

  private float(cx: number, cy: number, text: string, color: string) {
    const cell = this.cellPx();
    this.floats.push({
      x: (cx + 0.5) * cell,
      y: (cy + 0.3) * cell,
      text,
      color,
      life: 0,
      maxLife: 900,
    });
  }

  private tick() {
    if (this.queue.length > 0) this.dir = this.queue.shift() as DirName;
    const d = DIRS[this.dir];
    this.prevSnake = this.snake.map((c) => ({ ...c }));
    const head = this.snake[0];
    const nh = { x: head.x + d.x, y: head.y + d.y };

    // wall collision
    if (nh.x < 0 || nh.y < 0 || nh.x >= COLS || nh.y >= ROWS) return this.die();

    const eatsFood = nh.x === this.food.x && nh.y === this.food.y;
    const eatsBonus = this.bonus !== null && nh.x === this.bonus.x && nh.y === this.bonus.y;
    const willGrow = eatsFood || eatsBonus;

    // self collision (tail cell vacates unless growing)
    const body = willGrow ? this.snake : this.snake.slice(0, -1);
    if (body.some((c) => c.x === nh.x && c.y === nh.y)) return this.die();

    this.snake.unshift(nh);

    if (eatsFood) {
      this.score += 10;
      this.foods += 1;
      sfx.eat();
      this.burst(nh.x, nh.y, ["#ff6257", "#ff8a70", "#a3f55a"], 14, 1);
      this.float(nh.x, nh.y, "+10", "#a3f55a");
      this.spawnFood();
      if (this.foods % 5 === 0 && !this.bonus) this.spawnBonus();
      if (this.score > this.best) {
        this.best = this.score;
        if (!this.newBest) {
          this.newBest = true;
          this.float(nh.x, Math.max(1, nh.y), "NEW BEST!", "#ffcf5c");
        }
      }
    } else if (eatsBonus && this.bonus) {
      this.score += 50;
      sfx.bonus();
      this.burst(nh.x, nh.y, ["#ffcf5c", "#ffe59a", "#ffffff"], 20, 1.25);
      this.float(nh.x, nh.y, "+50", "#ffcf5c");
      this.bonus = null;
      if (this.score > this.best) {
        this.best = this.score;
        this.newBest = true;
      }
    } else {
      this.snake.pop();
    }

    // win — board full
    if (this.snake.length >= COLS * ROWS) {
      this.win = true;
      return this.die(true);
    }
    this.emit();
  }

  private die(win = false) {
    this.win = win;
    this.phase = "dying";
    this.dyingT = 800;
    this.shake = win ? 4 : 15;
    this.flash = win ? 0.25 : 1;
    if (win) sfx.record();
    else sfx.die();
    const h = this.snake[0];
    this.burst(h.x, h.y, win ? ["#ffcf5c", "#a3f55a", "#ffffff"] : ["#ff6257", "#3ddc84", "#ffcf5c"], win ? 30 : 24, 1.5);
    this.emit();
  }

  private update(dt: number, now: number) {
    // ambient motes
    for (const m of this.motes) {
      m.y -= m.sp * (dt / 16.7);
      m.x += Math.sin(now / 1400 + m.ph) * 0.0004 * dt * 0.06;
      if (m.y < -0.05) {
        m.y = 1.05;
        m.x = Math.random();
      }
    }

    // particles & floats tick always (juice continues over overlays)
    this.particles = this.particles.filter((p) => (p.life += dt) < p.maxLife);
    for (const p of this.particles) {
      p.x += p.vx * (dt / 16.7);
      p.y += p.vy * (dt / 16.7);
      p.vy += p.grav * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
    }
    this.floats = this.floats.filter((f) => (f.life += dt) < f.maxLife);
    this.shake *= Math.pow(0.92, dt / 16.7);
    if (this.shake < 0.15) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt / 620);

    if (this.phase === "ready") {
      this.readyT -= dt;
      if (this.readyT <= 0) {
        this.phase = "playing";
        this.acc = 0;
        sfx.go();
        const cell = this.cellPx();
        this.floats.push({
          x: (COLS / 2) * cell,
          y: (ROWS / 2) * cell,
          text: "GO!",
          color: "#ffcf5c",
          life: 0,
          maxLife: 700,
        });
        this.emit();
      }
      return;
    }

    if (this.phase === "dying") {
      this.dyingT -= dt;
      if (this.dyingT <= 0) {
        if (this.score > 0 && this.score >= this.best) saveBest(this.difficulty, this.best);
        this.phase = "over";
        if (!this.win) sfx.gameover();
        if (this.newBest) sfx.record();
        this.emit();
      }
      return;
    }

    if (this.phase !== "playing") return;

    if (this.bonus) {
      this.bonus.ttl -= dt;
      if (this.bonus.ttl <= 0) {
        this.burst(this.bonus.x, this.bonus.y, ["#93b8a4"], 6, 0.5);
        this.bonus = null;
      }
    }

    this.acc += dt;
    const step = this.interval();
    let guard = 0;
    while (this.acc >= step && guard++ < 4) {
      this.acc -= step;
      this.tick();
      if (this.phase !== "playing") break;
    }
    this.alpha = Math.min(1, this.acc / step);
  }

  // ---------- rendering ----------

  private render(now: number) {
    const { ctx, cssW: w, cssH: h } = this;
    if (w <= 0 || h <= 0) return;
    const cell = Math.min(w, h) / COLS;
    const ox = (w - cell * COLS) / 2;
    const oy = (h - cell * ROWS) / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    ctx.translate(ox, oy);

    this.drawBoard(ctx, cell, now);
    this.drawMotes(ctx, cell, now);
    this.drawFood(ctx, cell, now);
    if (this.bonus) this.drawBonus(ctx, cell, now);
    this.drawSnake(ctx, cell, now);
    this.drawParticles(ctx);
    this.drawFloats(ctx, cell);

    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 80, 64, ${(this.flash * 0.32).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawBoard(ctx: CanvasRenderingContext2D, cell: number, now: number) {
    ctx.fillStyle = "#0a1e15";
    ctx.fillRect(0, 0, cell * COLS, cell * ROWS);
    ctx.fillStyle = "rgba(61, 220, 132, 0.045)";
    for (let y = 0; y < ROWS; y++) {
      for (let x = (y % 2); x < COLS; x += 2) {
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    // sparse cross dots
    ctx.fillStyle = "rgba(163, 245, 90, 0.09)";
    for (let y = 3; y < ROWS; y += 6) {
      for (let x = 3; x < COLS; x += 6) {
        ctx.fillRect(x * cell - 1, y * cell - 1, 2, 2);
      }
    }
    // breathing inner border
    const pulse = 0.35 + 0.15 * Math.sin(now / 900);
    ctx.strokeStyle = `rgba(255, 207, 92, ${pulse.toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(1.5, 1.5, cell * COLS - 3, cell * ROWS - 3);
    ctx.strokeStyle = "rgba(39, 92, 65, 0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(4.5, 4.5, cell * COLS - 9, cell * ROWS - 9);
  }

  private drawMotes(ctx: CanvasRenderingContext2D, cell: number, now: number) {
    for (const m of this.motes) {
      const a = 0.1 + 0.1 * (0.5 + 0.5 * Math.sin(now / 700 + m.ph));
      ctx.fillStyle = m.gold ? `rgba(255, 207, 92, ${a.toFixed(3)})` : `rgba(61, 220, 132, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(m.x * cell * COLS, m.y * cell * ROWS, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFood(ctx: CanvasRenderingContext2D, cell: number, now: number) {
    const px = (this.food.x + 0.5) * cell;
    const py = (this.food.y + 0.5) * cell;
    const r = cell * 0.34 * (1 + 0.07 * Math.sin(now / 260));
    ctx.save();
    ctx.shadowColor = "rgba(255, 98, 87, 0.85)";
    ctx.shadowBlur = cell * 0.55;
    const g = ctx.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.15, px, py, r);
    g.addColorStop(0, "#ffb09a");
    g.addColorStop(0.55, "#ff6257");
    g.addColorStop(1, "#d92f2f");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // stem + leaf
    ctx.strokeStyle = "#7a4a21";
    ctx.lineWidth = Math.max(1.5, cell * 0.06);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(px, py - r * 0.9);
    ctx.lineTo(px + r * 0.12, py - r * 1.35);
    ctx.stroke();
    ctx.fillStyle = "#3ddc84";
    ctx.save();
    ctx.translate(px + r * 0.45, py - r * 1.2);
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.42, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // shine
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(px - r * 0.35, py - r * 0.38, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBonus(ctx: CanvasRenderingContext2D, cell: number, now: number) {
    const b = this.bonus!;
    const px = (b.x + 0.5) * cell;
    const py = (b.y + 0.5) * cell;
    const blinking = b.ttl < 2000 && Math.floor(now / 140) % 2 === 0;
    const r = cell * 0.36;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(now / 600);
    ctx.shadowColor = "rgba(255, 207, 92, 0.9)";
    ctx.shadowBlur = cell * 0.7;
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, "#ffe59a");
    g.addColorStop(1, "#f0a92e");
    ctx.fillStyle = blinking ? "rgba(255, 207, 92, 0.35)" : g;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.72, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.72, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // ttl ring
    ctx.strokeStyle = "rgba(255, 207, 92, 0.8)";
    ctx.lineWidth = Math.max(1.5, cell * 0.07);
    ctx.beginPath();
    ctx.arc(px, py, cell * 0.55, -Math.PI / 2, -Math.PI / 2 + (b.ttl / b.max) * Math.PI * 2);
    ctx.stroke();
  }

  private lerpPoints(cell: number): { x: number; y: number }[] {
    const t = this.phase === "playing" ? this.alpha : 1;
    return this.snake.map((c, i) => {
      const p = this.prevSnake[Math.min(i, this.prevSnake.length - 1)] ?? c;
      return {
        x: (p.x + (c.x - p.x) * t + 0.5) * cell,
        y: (p.y + (c.y - p.y) * t + 0.5) * cell,
      };
    });
  }

  private drawSnake(ctx: CanvasRenderingContext2D, cell: number, now: number) {
    const pts = this.lerpPoints(cell);
    if (pts.length === 0) return;
    const dying = this.phase === "dying" || this.phase === "over";
    const flashWhite = dying && Math.floor(now / 110) % 2 === 0;

    const head = pts[0];
    const tail = pts[pts.length - 1];
    const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    if (dying && !this.win) {
      grad.addColorStop(0, flashWhite ? "#ffffff" : "#ff6257");
      grad.addColorStop(1, flashWhite ? "#ffb3ad" : "#8a2420");
    } else {
      grad.addColorStop(0, "#c8ff70");
      grad.addColorStop(0.45, "#3ddc84");
      grad.addColorStop(1, "#0f7a4d");
    }

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = dying && !this.win ? "rgba(255,98,87,0.6)" : "rgba(61,220,132,0.5)";
    ctx.shadowBlur = cell * 0.55;
    ctx.strokeStyle = grad;
    ctx.lineWidth = cell * 0.68;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (pts.length === 1) ctx.lineTo(pts[0].x + 0.01, pts[0].y);
    ctx.stroke();
    ctx.restore();

    // inner highlight
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(240, 255, 220, 0.16)";
    ctx.lineWidth = cell * 0.3;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();

    // ---- head ----
    const d = DIRS[this.dir];
    const hx = head.x;
    const hy = head.y;
    const hr = cell * 0.46;
    ctx.save();
    if (!dying) {
      ctx.shadowColor = "rgba(200,255,112,0.7)";
      ctx.shadowBlur = cell * 0.5;
    }
    ctx.fillStyle = dying && !this.win ? (flashWhite ? "#ffffff" : "#ff8a70") : "#d6ff8f";
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.phase !== "over") {
      // eyes
      const exo = d.y !== 0 ? 1 : 0;
      const eyo = d.x !== 0 ? 1 : 0;
      const fwd = cell * 0.14;
      const side = cell * 0.19;
      for (const s of [-1, 1]) {
        const ex = hx + d.x * fwd + exo * side * s;
        const ey = hy + d.y * fwd + eyo * side * s;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ex, ey, cell * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0a1c14";
        ctx.beginPath();
        ctx.arc(ex + d.x * cell * 0.05, ey + d.y * cell * 0.05, cell * 0.065, 0, Math.PI * 2);
        ctx.fill();
      }
      // tongue flick
      const flick = (now / 1000) % 2.3;
      if (flick < 0.28 && this.phase === "playing" && !prefersReducedMotion()) {
        const len = cell * (0.45 + 0.2 * Math.sin((flick / 0.28) * Math.PI));
        ctx.strokeStyle = "#ff6257";
        ctx.lineWidth = Math.max(1.5, cell * 0.07);
        ctx.lineCap = "round";
        const sx = hx + d.x * hr * 0.9;
        const sy = hy + d.y * hr * 0.9;
        const tx = sx + d.x * len;
        const ty = sy + d.y * len;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + (d.y !== 0 ? 1 : 0.7) * cell * 0.12, ty + (d.x !== 0 ? 1 : 0.7) * cell * 0.12);
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - (d.y !== 0 ? 1 : 0.7) * cell * 0.12, ty - (d.x !== 0 ? 1 : 0.7) * cell * 0.12);
        ctx.stroke();
      }
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const a = 1 - p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawFloats(ctx: CanvasRenderingContext2D, cell: number) {
    for (const f of this.floats) {
      const k = f.life / f.maxLife;
      const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `${Math.round(cell * 0.5)}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = f.color;
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 6;
      ctx.fillText(f.text, f.x, f.y - k * cell * 1.1);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }
}
