import { useCallback, useSyncExternalStore } from "react";
import { autoTvMode } from "./input";

export interface ControlMode {
  /** Coarse primary pointer, regardless of whether it's a TV or a touch tablet/phone. */
  isCoarse: boolean;
  /** Likely a TV: coarse pointer (or no hover) on a big, landscape screen. */
  isTv: boolean;
  /** True on touch tablets/phones; false on a TV (where a remote is the primary input). */
  isTouch: boolean;
}

let latest: ControlMode = typeof window === "undefined" ? { isCoarse: false, isTv: false, isTouch: false } : compute();

function compute(): ControlMode {
  const isCoarse =
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const isTv = autoTvMode();
  return { isCoarse, isTv, isTouch: isCoarse && !isTv };
}

const subscribe = (onChange: () => void) => {
  const onResize = () => {
    latest = compute();
    onChange();
  };
  window.addEventListener("resize", onResize);
  // Orientation changes don't always fire resize on some TV browsers; watch those too.
  window.addEventListener("orientationchange", onResize);
  return () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
  };
};

const getSnapshot = () => latest;

function getServerSnapshot(): ControlMode {
  return { isCoarse: false, isTv: false, isTouch: false };
}

/**
 * Live control mode — recomputed on every resize/orientation change, so
 * plugging a laptop into a TV or rotating a tablet mid-session is detected.
 *
 * `isTv` reuses the same heuristics as the old `autoTvMode()` from
 * `src/ui/input.ts`. `isTouch` is `isCoarse && !isTv`, so phone-style thumb
 * controls are never shown on a TV where a remote is the primary input.
 */
export function useControlMode(): ControlMode {
  const subscribeCb = useCallback(subscribe, []);
  const getSnapshotCb = useCallback(
    () => (typeof window === "undefined" ? getServerSnapshot() : getSnapshot()),
    [],
  );
  return useSyncExternalStore(subscribeCb, getSnapshotCb, getServerSnapshot);
}