import { sfx } from "./audio";
import type { Held } from "../ui/input";

export type InvPhase = "idle" | "playing" | "over" | "win";
export interface InvHud {
  phase: InvPhase;
  score: number;
  lives: number;
  best: number;
}

const ROWS = 5;
const COLS = 8;
const HUD_MARGIN = 46;
const FMARGIN = 18;
const ROW_VALUE = [30, 25, 20, 15, 10];
const SHOT_R = 3;
const BULLET_SPEED = 0.52; // × H per second

export interface InvBullet {
  x: number;
  y: number;
  vy: number;
  from: "you" | "ghost";
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class Invaders {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHud: (h: InvHud) => void;
  private input: { current: Held };
  private raf = 0;
  private last = 0;
  private destroyed = false;
  private W = 0;
  private H = 0;

  phase: InvPhase = "idle";
  private score = 0;
  private lives = 3;
  best = 0;

  private px = 0;
  private invaders: boolean[] = new Array(ROWS * COLS).fill(true);
  private ox = 0;
  private dir: 1 | -1 = 1;
  private stepT = 0;
  private bullets: InvBullet[] = [];
  private fireCd = 0;
  private hitFlash = 0;

  constructor(
    canvas: HTMLCanvasElement,
    onHud: (h: InvHud) => void,
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
  }

  start() {
    this.score = 0;
    this.lives = 3;
    this.invaders = new Array(ROWS * COLS).fill(true);
    this.ox = 0;
    this.dir = 1;
    this.bullets = [];
    this.phase = "playing";
    this.fireCd = 400;
    this.stepT = 0;
    sfx.go();
    this.emit();
  }

  private emit() {
    this.onHud({ phase: this.phase, score: this.score, lives: this.lives, best: this.best });
  }

  private cellMetrics() {
    const iw = clamp((this.W - FMARGIN * 2) / COLS, 18, 40);
    const ih = iw * 0.72;
    const total = COLS * iw;
    const x0 = (this.W - total) / 2 + this.ox;
    return { iw, ih, x0, y0: HUD_MARGIN };
  }

  private aliveCount() {
    return this.invaders.filter(Boolean).length;
  }

  private update(dt: number) {
    const { W, H } = this;
    if (W <= 0 || H <= 0) return;
    const held = this.input.current;
    this.hitFlash = Math.max(0, this.hitFlash - dt / 300);

    if (this.phase !== "playing") return;

    // player movement + fire
    const psp = W * 0.5 * (dt / 1000);
    const pdir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    this.px = clamp(this.px + pdir * psp, 24, W - 24);
    this.fireCd -= dt;
    if (held.fire) {
      held.fire = false;
      if (this.fireCd <= 0) {
        this.fireCd = 320;
        this.bullets.push({ x: this.px, y: H - 46, vy: -BULLET_SPEED * H, from: "you" });
        sfx.shoot();
      }
    }

    // invader movement
    this.stepT -= dt;
    const { iw, ih, x0, y0 } = this.cellMetrics();
    const incr = 1.04 - this.aliveCount() / (ROWS * COLS); // 0.04 .. 1.04
    const period = 420 + 720 * incr;
    if (this.stepT <= 0) {
      this.stepT = period;
      const liveCols = new Set<number>();
      let maxRight = -Infinity;
      let minLeft = Infinity;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!this.invaders[r * COLS + c]) continue;
          liveCols.add(c);
          maxRight = Math.max(maxRight, x0 + (c + 1) * iw);
          minLeft = Math.min(minLeft, x0 + c * iw);
        }
      }
      if (this.dir === 1 && maxRight > W - FMARGIN) {
        this.dir = -1;
        this.ox += iw * 0.6;
      } else if (this.dir === -1 && minLeft < FMARGIN) {
        this.dir = 1;
        this.ox += iw * 0.6;
      } else {
        this.ox += this.dir * iw * 0.5;
      }
    }

    // bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy * (dt / 1000);
      if (b.y < -10 || b.y > H + 10) {
        this.bullets.splice(i, 1);
        continue;
      }
      if (b.from === "you") {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const gi = r * COLS + c;
            if (!this.invaders[gi]) continue;
            const gx = x0 + c * iw;
            const gy = y0 + r * ih;
            if (
              b.x >= gx - 2 &&
              b.x <= gx + iw + 2 &&
              b.y >= gy - 2 &&
              b.y <= gy + ih + 2
            ) {
              this.invaders[gi] = false;
              this.score += ROW_VALUE[r];
              this.bullets.splice(i, 1);
              sfx.merge();
              this.emit();
              if (this.aliveCount() === 0) {
                this.phase = "win";
                if (this.score > this.best) this.best = this.score;
                this.hitFlash = 1;
                sfx.pongwin();
                this.emit();
                return;
              }
              break;
            }
          }
        }
      } else if (
        Math.abs(b.x - this.px) < 14 &&
        Math.abs(b.y - (H - 42)) < 16
      ) {
        this.bullets.splice(i, 1);
        this.lives -= 1;
        this.hitFlash = 1;
        sfx.boom();
        if (this.lives <= 0) {
          this.phase = "over";
          if (this.score > this.best) this.best = this.score;
          sfx.gameover();
          this.emit();
          return;
        }
        this.emit();
      }
    }

    // ghosts return fire
    if (Math.random() < 0.00075 * dt * (this.aliveCount() / (ROWS * COLS))) {
      const cols = [];
      for (let c = 0; c < COLS; c++) {
        for (let r = ROWS - 1; r >= 0; r--) {
          if (this.invaders[r * COLS + c]) {
            cols.push({ c: c, x: x0 + c * iw + iw / 2, y: y0 + (r + 1) * ih });
            break;
          }
        }
      }
      if (cols.length > 0) {
        const pick = cols[Math.floor(Math.random() * cols.length)];
        this.bullets.push({ x: pick.x, y: pick.y, vy: BULLET_SPEED * H * 0.7, from: "ghost" });
        sfx.slide();
      }
    }

    // invaders reached the deck
    if (this.ox + (COLS) * iw > H * 0.62) {
      this.phase = "over";
      if (this.score > this.best) this.best = this.score;
      sfx.gameover();
      this.emit();
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
    ctx.moveTo(0, H - 58);
    ctx.lineTo(W, H - 58);
    ctx.stroke();
    ctx.setLineDash([]);

    const { iw, ih, x0, y0 } = this.cellMetrics();
    const rowCls = ["#ff6257", "#ff9f5c", "#ffcf5c", "#a3f55a", "#3ddc84"];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const gi = r * COLS + c;
        if (!this.invaders[gi]) continue;
        const x = x0 + c * iw;
        const y = y0 + r * ih;
        ctx.save();
        ctx.shadowColor = rowCls[r];
        ctx.shadowBlur = 8;
        ctx.fillStyle = rowCls[r];
        ctx.beginPath();
        ctx.roundRect(x + 1, y + ih * 0.2, iw - 2, ih * 0.6, 3);
        ctx.fill();
        ctx.restore();
      }
    }

    // family counter
    if (this.aliveCount() <= 3 && this.aliveCount() > 0) {
      ctx.fillStyle = "rgba(255,207,92,0.6)";
      ctx.font = '600 11px "Space Grotesk", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("hurry!", W / 2, HUD_MARGIN - 12);
    }

    // bullets
    for (const b of this.bullets) {
      ctx.save();
      ctx.shadowColor = b.from === "you" ? "#a3f55a" : "#ff6257";
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.from === "you" ? "#a3f55a" : "#ff6257";
      ctx.fillRect(b.x - SHOT_R / 2, b.y - 6, SHOT_R, 12);
      ctx.restore();
    }

    // player
    if (this.phase !== "over" && this.hitFlash < 0.55) {
      ctx.save();
      ctx.shadowColor = "rgba(163,245,90,0.7)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#a3f55a";
      ctx.beginPath();
      ctx.moveTo(this.px, H - 42);
      ctx.lineTo(this.px - 13, H - 56);
      ctx.lineTo(this.px + 13, H - 56);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,98,87,${(this.hitFlash * 0.28).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}