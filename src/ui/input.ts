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