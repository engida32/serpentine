import { sfx } from "./audio";
import type { Held } from "../ui/input";

export type BreakPhase = "idle" | "serve" | "playing" | "over" | "win";
export interface BreakHud {
  phase: BreakPhase;
  score: number;
  lives: number;
  best: number;
}

const BCOLS = 8;
const BROW5 = 5;
const BH = 18;
const BGAP = 4;
const BMARGIN = 54;
const BALL_R = 6;
const PAD_H = 14;

const ROW_VALUE = [50, 40, 30, 20, 10];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class Breakout {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHud: (h: BreakHud) => void;
  private input: { current: Held };
  private raf = 0;
  private last = 0;
  private destroyed = false;
  private W = 0;
  private H = 0;

  phase: BreakPhase = "idle";
  private score = 0;
  private lives = 3;
  best = 0;

  private px = 0;
  private ball = { x: 0, y: 0, vx: 0, vy: 0 };
  private bricks: boolean[] = new Array(BCOLS * BROW5).fill(true);
  private serveT = 0;
  private flash = 0;

  constructor(
    canvas: HTMLCanvasElement,
    onHud: (h: BreakHud) => void,
    input: { current: Held },
    best: number,
  ) {
    this.canvas = canvas;
    this.onHud = onHud;
    this.input = input;
    this.best = best;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.last = performance.now();
    const loop = (t: number) => {
      if (this.destroyed) return;
      const dt = Math.min(50, t - this.last);
      this.last = t;
      this.update(dt);
      this.render(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
  }

  resize(w: number, h: number, dpr: number) {
    this.W = w;
    this.H = h;
    const d = Math.min(2, dpr || 1);
    this.canvas.width = Math.max(1, Math.round(w * d));
    this.canvas.height = Math.max(1, Math.round(h * d));
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    this.resetLayout();
  }

  private resetLayout() {
    this.px = this.W / 2;
    this.ball.x = this.px;
    this.ball.y = this.H - 40;
    this.ball.vx = 0;
    this.ball.vy = 0;
  }

  start() {
    this.score = 0;
    this.lives = 3;
    this.bricks = new Array(BCOLS * BROW5).fill(true);
    this.serve();
  }

  private serve() {
    this.phase = "serve";
    this.serveT = 1100;
    this.resetLayout();
    sfx.ready();
    this.emit();
  }

  private launch() {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const angle = (0.2 + Math.random() * 0.3) * Math.PI * dir;
    const sp = this.H * 0.42;
    this.ball.vx = Math.cos(angle) * sp;
    this.ball.vy = -Math.abs(Math.sin(angle)) * sp;
  }

  private endOver() {
    this.phase = "over";
    if (this.score > this.best) this.best = this.score;
    this.flash = 1;
    sfx.gameover();
    this.emit();
  }

  private endWin() {
    this.phase = "win";
    if (this.score > this.best) this.best = this.score;
    this.flash = 1;
    sfx.pongwin();
    this.emit();
  }

  private emit() {
    this.onHud({ phase: this.phase, score: this.score, lives: this.lives, best: this.best });
  }

  private brickRect(c: number, r: number): { x: number; y: number; w: number; h: number } {
    const total = BCOLS * (BH + BGAP) - BGAP;
    const x0 = (this.W - total) / 2;
    return { x: x0 + c * (BH + BGAP), y: BMARGIN + r * (BH + BGAP), w: BH, h: BH };
  }

  private update(dt: number) {
    const { W, H } = this;
    if (W <= 0 || H <= 0) return;
    const held = this.input.current;
    this.flash = Math.max(0, this.flash - dt / 500);

    const psp = W * 0.55 * (dt / 1000);
    const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    this.px = clamp(this.px + dir * psp, 30, W - 30);

    if (this.phase === "serve") {
      this.serveT -= dt;
      this.ball.x = this.px;
      this.ball.y = this.H - 40;
      if (this.serveT <= 0 || held.fire) {
        held.fire = false;
        this.phase = "playing";
        this.launch();
        this.emit();
      }
      return;
    }
    if (this.phase !== "playing") return;

    this.ball.x += this.ball.vx * (dt / 1000);
    this.ball.y += this.ball.vy * (dt / 1000);

    // walls
    if (this.ball.x - BALL_R < 0) {
      this.ball.x = BALL_R;
      this.ball.vx = Math.abs(this.ball.vx);
      sfx.wall();
    } else if (this.ball.x + BALL_R > W) {
      this.ball.x = W - BALL_R;
      this.ball.vx = -Math.abs(this.ball.vx);
      sfx.wall();
    }
    if (this.ball.y - BALL_R < 0) {
      this.ball.y = BALL_R;
      this.ball.vy = Math.abs(this.ball.vy);
      sfx.wall();
    }

    // paddle
    const py = H - 34;
    if (
      this.ball.vy > 0 &&
      Math.abs(this.ball.y + BALL_R - py) < 6 &&
      Math.abs(this.ball.x - this.px) < (this.W * 0.16) / 2 + BALL_R
    ) {
      const rel = clamp((this.ball.x - this.px) / (this.W * 0.16 / 2), -1, 1);
      const angle = rel * (Math.PI / 3);
      const sp = Math.hypot(this.ball.vx, this.ball.vy) * 1.02;
      this.ball.vx = Math.sin(angle) * sp;
      this.ball.vy = -Math.abs(Math.cos(angle)) * sp;
      this.ball.y = py - BALL_R;
      sfx.paddle();
    }

    // bricks
    for (let r = 0; r < BROW5; r++) {
      for (let c = 0; c < BCOLS; c++) {
        const i = r * BCOLS + c;
        if (!this.bricks[i]) continue;
        const br = this.brickRect(c, r);
        const bx = clamp(this.ball.x, br.x, br.x + br.w);
        const by = clamp(this.ball.y, br.y, br.y + br.h);
        const dx = this.ball.x - bx;
        const dy = this.ball.y - by;
        if (dx * dx + dy * dy <= BALL_R * BALL_R) {
          this.bricks[i] = false;
          this.score += ROW_VALUE[r];
          if (flipVertical(dy, dx)) this.ball.vy *= -1;
          else this.ball.vx *= -1;
          this.ball.y = clamp(this.ball.y, br.y - BALL_R, br.y + br.h + BALL_R);
          sfx.merge();
          this.emit();
          if (this.bricks.every((b) => !b)) return this.endWin();
          return;
        }
      }
    }

    // ball lost
    if (this.ball.y - BALL_R > H) {
      this.lives -= 1;
      sfx.point();
      if (this.lives <= 0) return this.endOver();
      this.serve();
    }
  }

  private render(t: number) {
    const { ctx, W, H } = this;
    if (W <= 0 || H <= 0) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#06110c";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(61,220,132,0.18)";
    ctx.setLineDash([6, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H - 56);
    ctx.lineTo(W, H - 56);
    ctx.stroke();
    ctx.setLineDash([]);

    // bricks
    const rowCls = ["#ff6257", "#ffcf5c", "#a3f55a", "#3ddc84", "#2b6b52"];
    for (let r = 0; r < BROW5; r++) {
      for (let c = 0; c < BCOLS; c++) {
        const i = r * BCOLS + c;
        if (!this.bricks[i]) continue;
        const br = this.brickRect(c, r);
        ctx.save();
        ctx.shadowColor = rowCls[r];
        ctx.shadowBlur = 8;
        ctx.fillStyle = rowCls[r];
        ctx.globalAlpha = 1 - r * 0.12;
        ctx.beginPath();
        ctx.roundRect(br.x, br.y, br.w, br.h, 4);
        ctx.fill();
        ctx.restore();
      }
    }

    // paddle
    const pw = this.W * 0.16;
    ctx.save();
    ctx.shadowColor = "rgba(163,245,90,0.7)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#a3f55a";
    ctx.beginPath();
    ctx.roundRect(this.px - pw / 2, this.H - 41, pw, PAD_H, 6);
    ctx.fill();
    ctx.restore();

    // ball
    ctx.save();
    ctx.shadowColor = "rgba(238,246,236,0.9)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#eef6ec";
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.phase === "serve") {
      const frac = this.serveT / 1100;
      ctx.globalAlpha = Math.min(1, frac * 1.4);
      ctx.font = `${Math.max(18, Math.round(W * 0.07))}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffcf5c";
      ctx.shadowColor = "rgba(255,207,92,0.5)";
      ctx.shadowBlur = 12;
      ctx.fillText(Math.ceil(this.serveT / 400).toString(), W / 2, H * 0.4);
      ctx.globalAlpha = 1;
    }
  }
}

function flipVertical(dy: number, dx: number): boolean {
  return Math.abs(dy) >= Math.abs(dx);
}