/* Tiny WebAudio synth — all SFX generated procedurally, no assets. */

type Wave = OscillatorType;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Call from a user gesture to unlock audio. */
  unlock() {
    this.ensure();
  }

  private tone(
    freq: number,
    dur: number,
    opts: { wave?: Wave; vol?: number; slide?: number; delay?: number } = {},
  ) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const { wave = "square", vol = 1, slide = 0, delay = 0 } = opts;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  click() {
    this.tone(660, 0.06, { wave: "square", vol: 0.5 });
  }
  select() {
    this.tone(520, 0.07, { vol: 0.55 });
    this.tone(780, 0.09, { vol: 0.5, delay: 0.06 });
  }
  eat() {
    this.tone(430, 0.07, { vol: 0.8, slide: 240 });
    this.tone(860, 0.09, { wave: "triangle", vol: 0.6, delay: 0.05 });
  }
  bonus() {
    [660, 880, 1320].forEach((f, i) => this.tone(f, 0.1, { wave: "triangle", vol: 0.7, delay: i * 0.07 }));
  }
  die() {
    this.tone(320, 0.42, { wave: "sawtooth", vol: 0.75, slide: -260 });
    this.tone(140, 0.5, { wave: "square", vol: 0.5, slide: -90, delay: 0.08 });
  }
  pause() {
    this.tone(392, 0.09, { vol: 0.5 });
    this.tone(262, 0.12, { vol: 0.45, delay: 0.08 });
  }
  resume() {
    this.tone(262, 0.09, { vol: 0.5 });
    this.tone(392, 0.12, { vol: 0.5, delay: 0.08 });
  }
  ready() {
    this.tone(440, 0.09, { wave: "triangle", vol: 0.55 });
  }
  go() {
    this.tone(880, 0.16, { wave: "triangle", vol: 0.7 });
    this.tone(1174, 0.2, { wave: "triangle", vol: 0.5, delay: 0.05 });
  }
  start() {
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.11, { wave: "triangle", vol: 0.6, delay: i * 0.07 }));
  }
  gameover() {
    [523, 392, 311, 262].forEach((f, i) => this.tone(f, 0.16, { wave: "square", vol: 0.4, delay: i * 0.12 }));
  }
  record() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.14, { wave: "triangle", vol: 0.6, delay: i * 0.08 }));
  }
}

export const sfx = new Sfx();
