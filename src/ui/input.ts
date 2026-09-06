import { useEffect, useRef } from "react";
import { sfx } from "../game/audio";
import type { DirName } from "../game/engine";

export interface GlobalControls {
  onDir: (d: DirName) => void;
  onPrimary?: () => void; // A / confirm
  onSecondary?: () => void; // B / pause
  onStart?: () => void; // Start button
  onBack?: () => void; // Back / select button
}

const DIR_TIMEOUT = 150;
const BTN_TIMEOUT = 260;

/**
 * Polls the Gamepad API (TV remotes, air mouses with D-pad, joypads).
 * Axis + D-pad buttons map to directions; face/start/back buttons map to actions.
 */
export function useGamepad(c: GlobalControls) {
  const cbRef = useRef(c);
  cbRef.current = c;

  useEffect(() => {
    if (typeof navigator === "undefined" || !("getGamepads" in navigator)) return;
    let lastDir = 0;
    let lastA = 0;
    let lastB = 0;
    let lastStart = 0;
    let lastBack = 0;

    const id = window.setInterval(() => {
      let pads: (Gamepad | null)[];
      try {
        pads = navigator.getGamepads();
      } catch {
        pads = [];
      }
      for (const gp of pads) {
        if (!gp) continue;
        const b = gp.buttons;
        const ax = gp.axes[0] ?? 0;
        const ay = gp.axes[1] ?? 0;
        const up = (b[12]?.pressed && b[12].value > 0) || ay < -0.5;
        const down = (b[13]?.pressed && b[13].value > 0) || ay > 0.5;
        const left = (b[14]?.pressed && b[14].value > 0) || ax < -0.5;
        const right = (b[15]?.pressed && b[15].value > 0) || ax > 0.5;
        const now = performance.now();
        if ((up || down || left || right) && now - lastDir > DIR_TIMEOUT) {
          lastDir = now;
          sfx.unlock();
          cbRef.current.onDir(up ? "up" : down ? "down" : left ? "left" : "right");
        }
        const fire = (last: number, held: boolean, cb?: () => void) => {
          if (held && cb && now - last > BTN_TIMEOUT) {
            return { last: now, fired: true };
          }
          return { last, fired: false };
        };
        const a = fire(lastA, !!b[0]?.pressed, cbRef.current.onPrimary);
        lastA = a.last;
        if (a.fired) cbRef.current.onPrimary?.();
        const s = fire(lastB, !!b[1]?.pressed, cbRef.current.onSecondary);
        lastB = s.last;
        if (s.fired) cbRef.current.onSecondary?.();
        const st = fire(lastStart, !!b[9]?.pressed, cbRef.current.onStart);
        lastStart = st.last;
        if (st.fired) cbRef.current.onStart?.();
        const bk = fire(lastBack, !!b[8]?.pressed, cbRef.current.onBack);
        lastBack = bk.last;
        if (bk.fired) cbRef.current.onBack?.();
      }
    }, 80);

    return () => window.clearInterval(id);
  }, []);
}

/** True when the platform is likely a TV (coarse pointer on a big, landscape screen). */
export function autoTvMode(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const ratio = window.innerWidth / Math.max(1, window.innerHeight);
  return coarse && ratio >= 1.45 && window.innerWidth >= 900;
}

export interface Held {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** Latched rising edge — the game loop consumes it by clearing it. */
  fire: boolean;
}

const UP_KEYS = new Set(["arrowup", "w", "W"]);
const DOWN_KEYS = new Set(["arrowdown", "s", "S"]);
const LEFT_KEYS = new Set(["arrowleft", "a", "A"]);
const RIGHT_KEYS = new Set(["arrowright", "d", "D"]);
const FIRE_KEYS = new Set([" ", "enter"]);
const HOLD_DIRS = ["up", "down", "left", "right"] as const;
type HoldDir = (typeof HOLD_DIRS)[number];

/**
 * Continuous held-state input for motion games (Breakout, Invaders,
 * Asteroids): keyboard held keys, D-pad hold buttons and the Gamepad
 * API are merged every ~50ms into a shared snapshot. `fire` is latched
 * on the rising edge of a tap and must be consumed by the game loop.
 */
export function useRemoteHeld(): {
  held: React.MutableRefObject<Held>;
  setManual: (k: HoldDir | "fire", v: boolean) => void;
} {
  const held = useRef<Held>({ up: false, down: false, left: false, right: false, fire: false });
  const manual = useRef<Record<string, boolean>>({ up: false, down: false, left: false, right: false });

  const setManual = (k: HoldDir | "fire", v: boolean) => {
    if (k === "fire") {
      if (v) held.current.fire = true;
      return;
    }
    manual.current[k] = v;
  };

  useEffect(() => {
    const dirOf = (key: string): HoldDir | null => {
      if (UP_KEYS.has(key)) return "up";
      if (DOWN_KEYS.has(key)) return "down";
      if (LEFT_KEYS.has(key)) return "left";
      if (RIGHT_KEYS.has(key)) return "right";
      return null;
    };
    const onKey = (e: KeyboardEvent) => {
      sfx.unlock();
      const dir = dirOf(e.key);
      if (dir) {
        manual.current[dir] = true;
        e.preventDefault();
        return;
      }
      if (FIRE_KEYS.has(e.key)) {
        held.current.fire = true;
        e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const dir = dirOf(e.key);
      if (dir) manual.current[dir] = false;
    };
    const onVis = () => {
      if (document.hidden) manual.current = { up: false, down: false, left: false, right: false };
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      let gp: Gamepad | null = null;
      try {
        gp = navigator.getGamepads?.()[0] ?? null;
      } catch {
        gp = null;
      }
      if (gp) {
        const b = gp.buttons;
        const ax = gp.axes[0] ?? 0;
        const ay = gp.axes[1] ?? 0;
        const h = held.current;
        const up = (b[12]?.pressed && b[12].value > 0) || ay < -0.5;
        const down = (b[13]?.pressed && b[13].value > 0) || ay > 0.5;
        const left = (b[14]?.pressed && b[14].value > 0) || ax < -0.5;
        const right = (b[15]?.pressed && b[15].value > 0) || ax > 0.5;
        h.up = up || manual.current.up;
        h.down = down || manual.current.down;
        h.left = left || manual.current.left;
        h.right = right || manual.current.right;
        if (b[0]?.pressed) h.fire = true;
      } else {
        const h = held.current;
        h.up = manual.current.up;
        h.down = manual.current.down;
        h.left = manual.current.left;
        h.right = manual.current.right;
      }
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  return { held, setManual };
}