import { sfx } from "./audio";

export type PongPhase = "idle" | "serve" | "playing" | "paused" | "over";
export interface PongHud {
  phase: PongPhase;
  l: number;
  r: number;
  winner: 0 | 1 | null;
}

export const POINT_TARGET = 7;

const PW = 15;
const PH = 96;
const MM = 28;
const BR = 10;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class PongEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHud: (h: PongHud) => void;
  private raf = 0;
  private last = 0;
  private destroyed = false;
  private cssW = 0;
  private cssH = 0;

  phase: PongPhase = "idle";
  private l = 0;
  private r = 0;
  private winner: 0 | 1 | null = null;

  private p1y = 0;
  private p2y = 0;
  private bx = 0;
  private by = 0;
  private bvx = 0;
  private bvy = 0;

  private p1Up = false;
  private p1Down = false;
  private touchTarget: number | null = null;
  private aiError = 0;
  private aiErrT = 0;
  private serveT = 0;
  private flash = 0;
  private resumeTo: "serve" | "playing" | null = null;

  constructor(canvas: HTMLCanvasElement, onHud: (h: PongHud) => void) {
    this.canvas = canvas;
    this.onHud = onHud;
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

  resize(cssW: number, cssH: number, dpr: number) {
    this.cssW = cssW;
    this.cssH = cssH;
    const d = Math.min(2, dpr || 1);
    this.canvas.width = Math.max(1, Math.round(cssW * d));
    this.canvas.height = Math.max(1, Math.round(cssH * d));
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    this.p1y = this.p2y = cssH / 2;
  }

  setPlayerUp(v: boolean) {
    this.p1Up = v;
    this.touchTarget = null;
  }
  setPlayerDown(v: boolean) {
    this.p1Down = v;
    this.touchTarget = null;
  }
  setTouchTarget(y: number | null) {
    this.touchTarget = y;
  }

  start() {
    this.l = 0;
    this.r = 0;
    this.winner = null;
    this.resumeTo = null;
    this.beginServe();
  }

  togglePause() {
    if (this.phase === "paused") {
      this.phase = this.resumeTo ?? "playing";
      this.resumeTo = null;
      sfx.resume();
      this.emit();
      return;
    }
    if (this.phase === "serve" || this.phase === "playing") {
      this.resumeTo = this.phase;
      this.phase = "paused";
      sfx.pause();
      this.emit();
    }
  }

  getPhase() {
    return this.phase;
  }

  private beginServe() {
    this.phase = "serve";
    this.serveT = 900;
    this.bx = this.cssW / 2;
    this.by = this.cssH / 2;
    this.bvx = this.bvy = 0;
    sfx.ready();
    this.emit();
  }

  private launch() {
    const W = this.cssW;
    const H = this.cssH;
    const speed = H * 0.62;
    const dir = this.bvx < 0 ? 1 : -1;
    const angle = (Math.random() * 0.7 - 0.35) * (Math.PI / 2) * 0.7;
    this.bvx = Math.cos(angle) * speed * dir;
    this.bvy = Math.sin(angle) * speed;
    this.aiError = (Math.random() * 2 - 1) * PH * 0.45;
    this.aiErrT = 0;
  }

  private over(winner: 0 | 1) {
    this.winner = winner;
    this.phase = "over";
    this.flash = 1;
    if (winner === 0) sfx.pongwin();
    else sfx.gameover();
    this.emit();
  }

  private emit() {
    this.onHud({ phase: this.phase, l: this.l, r: this.r, winner: this.winner });
  }

  private update(dt: number) {
    const W = this.cssW;
    const H = this.cssH;
    if (W <= 0 || H <= 0) return;
    if (this.phase === "paused") return;

    this.flash = Math.max(0, this.flash - dt / 500);

    // player paddle (touch or held keys)
    if (this.touchTarget !== null) {
      this.p1y = clamp(this.touchTarget, MM + PH / 2, H - MM - PH / 2);
    } else {
      const spd = H * 0.62 * (dt / 1000);
      const dir = this.p1Up ? -1 : this.p1Down ? 1 : 0;
      this.p1y = clamp(this.p1y + dir * spd, MM + PH / 2, H - MM - PH / 2);
    }

    // CPU paddle
    const incoming = this.bvx > 0;
    this.aiErrT -= dt;
    if (this.aiErrT <= 0) {
      this.aiErrT = 900 + Math.random() * 700;
      this.aiError = (Math.random() * 2 - 1) * PH * 0.5;
    }
    const target = incoming ? this.by + this.aiError : H / 2;
    const aispd = H * 0.5 * (dt / 1000) * (incoming ? 1 : 0.5);
    const diff = target - this.p2y;
    const step = clamp(diff, -aispd, aispd);
    this.p2y = clamp(this.p2y + step, MM + PH / 2, H - MM - PH / 2);

    if (this.phase === "serve") {
      this.serveT -= dt;
      if (this.serveT <= 0) {
        this.phase = "playing";
        this.launch();
        this.emit();
      }
      return;
    }
    if (this.phase !== "playing") return;

    // ball
    const sp = H * 0.62;
    this.bx += this.bvx * (dt / 1000);
    this.by += this.bvy * (dt / 1000);

    // top/bottom walls
    if (this.by - BR < 0) {
      this.by = BR;
      this.bvy = Math.abs(this.bvy);
      sfx.wall();
    } else if (this.by + BR > H) {
      this.by = H - BR;
      this.bvy = -Math.abs(this.bvy);
      sfx.wall();
    }

    const ball = (px: number, py: number) =>
      px >= this.bx - BR && px <= this.bx + BR && py >= this.by - BR && py <= this.by + BR;

    if (this.bvx < 0 && ball(MM + PW, this.p1y)) {
      this.bounce(this.p1y, 1);
      return;
    }
    if (this.bvx > 0 && ball(W - MM - PW, this.p2y)) {
      this.bounce(this.p2y, -1);
      return;
    }

    // scoring
    if (this.bx + BR < 0) {
      this.r += 1;
      sfx.point();
      if (this.r >= POINT_TARGET) return this.over(1);
      this.launch();
      this.phase = "serve";
      this.serveT = 650;
      this.emit();
      return;
    }
    if (this.bx - BR > W) {
      this.l += 1;
      sfx.point();
      if (this.l >= POINT_TARGET) return this.over(0);
      this.launch();
      this.phase = "serve";
      this.serveT = 650;
      this.emit();
    }
  }

  private bounce(paddleY: number, side: number) {
    const rel = clamp((this.by - paddleY) / (PH / 2), -1, 1);
    const angle = rel * (Math.PI / 3);
    const speed = this.cssH * 0.62 * (1 + 0.03 * (this.l + this.r));
    this.bvx = Math.cos(angle) * speed * side;
    this.bvy = Math.sin(angle) * speed;
    this.bx = clamp(this.bx, MM + PW + BR + 1, this.cssW - MM - PW - BR - 1);
    sfx.paddle();
  }

  private render(t: number) {
    const { ctx, cssW: W, cssH: H } = this;
    if (W <= 0 || H <= 0) return;
    ctx.clearRect(0, 0, W, H);

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a1e15");
    grad.addColorStop(1, "#0a1e15");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // center dashed line
    ctx.strokeStyle = "rgba(61,220,132,0.28)";
    ctx.setLineDash([10, 12]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2, 14);
    ctx.lineTo(W / 2, H - 14);
    ctx.stroke();
    ctx.setLineDash([]);

    // center circle
    ctx.strokeStyle = "rgba(255,207,92,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.14, 0, Math.PI * 2);
    ctx.stroke();

    // paddles
    const drawPaddle = (x: number, y: number, color: string, glow: string) => {
      const g = ctx.createLinearGradient(x - PW / 2, 0, x + PW / 2, 0);
      g.addColorStop(0, "rgba(255,255,255,0.12)");
      g.addColorStop(0.35, color);
      g.addColorStop(1, color);
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = 18;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x - PW / 2, y - PH / 2, PW, PH, 7);
      ctx.fill();
      ctx.restore();
    };
    drawPaddle(MM, this.p1y, "#a3f55a", "rgba(163,245,90,0.65)");
    drawPaddle(W - MM, this.p2y, "#ff6257", "rgba(255,98,87,0.65)");

    // ball
    ctx.save();
    ctx.shadowColor = "rgba(238,246,236,0.9)";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#eef6ec";
    ctx.beginPath();
    ctx.arc(this.bx, this.by, BR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // serve countdown
    if (this.phase === "serve") {
      const frac = this.serveT / 900;
      ctx.globalAlpha = Math.min(1, frac * 1.4);
      ctx.font = `${Math.round(W * 0.09)}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffcf5c";
      ctx.shadowColor = "rgba(255,207,92,0.5)";
      ctx.shadowBlur = 14;
      ctx.fillText(Math.ceil(this.serveT / 300).toString(), W / 2, H * 0.42);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    if (this.flash > 0 && this.phase === "over") {
      ctx.fillStyle = `rgba(255,207,92,${(this.flash * 0.25).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}