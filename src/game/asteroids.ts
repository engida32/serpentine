import { sfx } from "./audio";
import { prefersReducedMotion } from "./motion";
import type { Held } from "../ui/input";

export type AstPhase = "idle" | "playing" | "paused" | "over";
export interface AstHud {
  phase: AstPhase;
  score: number;
  lives: number;
  best: number;
}

export interface Rock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  level: number;
  pts: number[];
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

const SHIP_R = 10;
const STAR = 60;

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function wrap(v: number, max: number) {
  return ((v % max) + max) % max;
}

function rockPts(r: number): number[] {
  const n = 9;
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = r * rand(0.6, 1.1);
    pts.push(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  return pts;
}

export class Asteroids {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHud: (h: AstHud) => void;
  private input: { current: Held };
  private raf = 0;
  private last = 0;
  private destroyed = false;
  private W = 0;
  private H = 0;

  phase: AstPhase = "idle";
  private score = 0;
  private lives = 3;
  best = 0;

  private ship = { x: 0, y: 0, vx: 0, vy: 0, ang: -Math.PI / 2 };
  private invuln = 0;
  private fireCd = 0;
  private resumeTo: "playing" | null = null;
  private rocks: Rock[] = [];
  private bullets: Bullet[] = [];
  private stars: { x: number; y: number; s: number }[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    onHud: (h: AstHud) => void,
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
    if (!prefersReducedMotion()) {
      for (let i = 0; i < STAR; i++) {
        this.stars.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.4 + 0.3 });
      }
    }
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
    this.rocks = [];
    this.bullets = [];
    this.ship = { x: this.W / 2, y: this.H / 2, vx: 0, vy: 0, ang: -Math.PI / 2 };
    this.invuln = 0;
    for (let i = 0; i < 3; i++) this.spawnRock(rand(0.6, 0.95), null);
    this.phase = "playing";
    this.resumeTo = null;
    sfx.go();
    this.emit();
  }

  togglePause() {
    if (this.phase === "paused") {
      this.phase = this.resumeTo ?? "playing";
      this.resumeTo = null;
      sfx.resume();
      this.emit();
      return;
    }
    if (this.phase === "playing") {
      this.resumeTo = "playing";
      this.phase = "paused";
      sfx.pause();
      this.emit();
    }
  }

  private safeSpawn(): { x: number; y: number } {
    const margin = SHIP_R + 16;
    let sx = this.W / 2;
    let sy = this.H / 2;
    for (let attempt = 0; attempt < 16; attempt++) {
      let safe = true;
      for (const r of this.rocks) {
        const dx = sx - r.x;
        const dy = sy - r.y;
        if (dx * dx + dy * dy < (r.r + margin) ** 2) {
          safe = false;
          // drift toward the corner opposite the offending rock, halving each pass
          sx = (sx + (r.x > sx ? this.W * 0.2 : this.W * 0.8)) / 2;
          sy = (sy + (r.y > sy ? this.H * 0.2 : this.H * 0.8)) / 2;
          break;
        }
      }
      if (safe) break;
    }
    return { x: sx, y: sy };
  }

  private spawnRock(r: number, at: { x: number; y: number } | null) {
    let x: number;
    let y: number;
    if (at) {
      x = at.x;
      y = at.y;
    } else {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) {
        x = rand(10, this.W - 10);
        y = rand(10, this.H * 0.2);
      } else if (side === 1) {
        x = rand(10, this.W - 10);
        y = rand(this.H * 0.8, this.H - 10);
      } else if (side === 2) {
        x = rand(10, this.W * 0.2);
        y = rand(10, this.H - 10);
      } else {
        x = rand(this.W * 0.8, this.W - 10);
        y = rand(10, this.H - 10);
      }
    }
    const sp = this.H * 0.09;
    const a = rand(0, Math.PI * 2);
    this.rocks.push({
      x,
      y,
      vx: Math.cos(a) * sp * rand(0.6, 1.2),
      vy: Math.sin(a) * sp * rand(0.6, 1.2),
      r: Math.max(8, this.H * 0.075 * r),
      level: r > 0.72 ? 3 : r > 0.4 ? 2 : 1,
      pts: rockPts(1),
    });
  }

  private emit() {
    this.onHud({ phase: this.phase, score: this.score, lives: this.lives, best: this.best });
  }

  private update(dt: number) {
    const { W, H } = this;
    if (W <= 0 || H <= 0) return;
    if (this.phase !== "playing") return;
    const held = this.input.current;
    this.invuln = Math.max(0, this.invuln - dt);

    // ship control
    const s = this.ship;
    const turn = H * 0.0045 * (dt / 1000) * 240; // ~3.2 rad/s scaled to height
    if (held.left) s.ang -= turn;
    if (held.right) s.ang += turn;
    if (held.up) {
      const thrust = H * 0.55 * (dt / 1000);
      s.vx += Math.cos(s.ang) * thrust;
      s.vy += Math.sin(s.ang) * thrust;
    }
    const max = H * 0.75;
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > max) {
      s.vx = (s.vx / sp) * max;
      s.vy = (s.vy / sp) * max;
    }
    s.x = wrap(s.x + s.vx * (dt / 1000), W);
    s.y = wrap(s.y + s.vy * (dt / 1000), H);

    this.fireCd -= dt;
    if (held.fire) {
      held.fire = false;
      if (this.fireCd <= 0) {
        this.fireCd = 250;
        const bs = H * 0.8;
        this.bullets.push({
          x: s.x + Math.cos(s.ang) * SHIP_R,
          y: s.y + Math.sin(s.ang) * SHIP_R,
          vx: s.vx * 0.35 + Math.cos(s.ang) * bs,
          vy: s.vy * 0.35 + Math.sin(s.ang) * bs,
          life: 1400,
        });
        sfx.shoot();
      }
    }

    // rocks drift + wrap
    for (const r of this.rocks) {
      r.x = wrap(r.x + r.vx * (dt / 1000), W);
      r.y = wrap(r.y + r.vy * (dt / 1000), H);
    }

    // bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * (dt / 1000);
      b.y += b.vy * (dt / 1000);
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
        this.bullets.splice(i, 1);
        continue;
      }
      for (let j = this.rocks.length - 1; j >= 0; j--) {
        const r = this.rocks[j];
        if ((b.x - r.x) ** 2 + (b.y - r.y) ** 2 < r.r * r.r) {
          this.bullets.splice(i, 1);
          this.splitRock(j);
          break;
        }
      }
    }

    // ship vs rocks
if (this.invuln <= 0) {
        for (let j = 0; j < this.rocks.length; j++) {
          const r = this.rocks[j];
          if ((s.x - r.x) ** 2 + (s.y - r.y) ** 2 < (SHIP_R + r.r) ** 2) {
            this.lives -= 1;
            this.invuln = 1600;
            const spawn = this.safeSpawn();
            this.ship = { x: spawn.x, y: spawn.y, vx: 0, vy: 0, ang: -Math.PI / 2 };
            sfx.boom();
          if (this.lives <= 0) {
            this.phase = "over";
            if (this.score > this.best) this.best = this.score;
            sfx.gameover();
            this.emit();
            return;
          }
          this.emit();
          break;
        }
      }
    }
  }

  private splitRock(j: number) {
    const r = this.rocks[j];
    const base = r.level === 3 ? 30 : r.level === 2 ? 20 : 10;
    this.score += base;
    sfx.merge();
    this.rocks.splice(j, 1);
    if (r.level > 1) {
      for (let k = 0; k < 2; k++) {
        this.spawnRock(r.level - 1, { x: r.x, y: r.y });
      }
    }
    this.emit();
  }

  private render(t: number) {
    const { ctx, W, H } = this;
    if (W <= 0 || H <= 0) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#06110c";
    ctx.fillRect(0, 0, W, H);

    // stars
    ctx.fillStyle = "rgba(238,246,236,0.55)";
    for (const st of this.stars) {
      ctx.fillRect(st.x * W, st.y * H, st.s, st.s);
    }

    // rocks
    for (const r of this.rocks) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.scale(r.r, r.r);
      ctx.beginPath();
      ctx.moveTo(r.pts[0], r.pts[1]);
      for (let k = 2; k < r.pts.length; k += 2) {
        ctx.lineTo(r.pts[k], r.pts[k + 1]);
      }
      ctx.closePath();
      ctx.shadowColor = "rgba(255,255,255,0.35)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#d8e2d5";
      ctx.fill();
      ctx.fillStyle = "rgba(6,17,12,0.55)";
      ctx.beginPath();
      ctx.moveTo(r.pts[0], r.pts[1]);
      for (let k = 0; k < r.pts.length - 2; k += 2) {
        ctx.lineTo(r.pts[k + 2], r.pts[k + 3]);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // bullets
    ctx.strokeStyle = "#a3f55a";
    ctx.shadowColor = "rgba(163,245,90,0.8)";
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + b.vx * 0.02, b.y + b.vy * 0.02);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // ship
    if (this.phase !== "over" && (this.invuln <= 0 || Math.floor(t / 160) % 2 === 0)) {
      const s = this.ship;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.ang + Math.PI / 2);
      ctx.shadowColor = "rgba(163,245,90,0.8)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#a3f55a";
      ctx.beginPath();
      ctx.moveTo(0, -SHIP_R);
      ctx.lineTo(SHIP_R * 0.7, SHIP_R * 0.8);
      ctx.lineTo(0, SHIP_R * 0.4);
      ctx.lineTo(-SHIP_R * 0.7, SHIP_R * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}