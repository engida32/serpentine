import { useEffect, useRef } from "react";
import { sfx } from "../game/audio";
import type { DirName } from "../game/engine";
import { activateFocused, activeMenu, installMenuAutofocus, isTextField, moveFocus } from "./focus";

/* ------------------------------------------------------------------ */
/* Key normalisation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Back / return keys across platforms:
 *  - Escape                 desktop, most Android TV browsers
 *  - GoBack / BrowserBack   webOS, Fire TV silk, some remotes
 *  - 461 / 10009            LG webOS / Samsung Tizen keyCodes
 *  - Backspace              Fire TV & many HDMI-CEC remotes (only outside text fields)
 */
export function isBackKey(e: KeyboardEvent): boolean {
  const k = e.key;
  if (k === "Escape" || k === "GoBack" || k === "BrowserBack") return true;
  if (e.keyCode === 461 || e.keyCode === 10009) return true;
  if (k === "Backspace" && !isTextField(e.target as Element | null)) return true;
  return false;
}

/** Media / remote keys that should behave like the gamepad Start button. */
export function isStartKey(e: KeyboardEvent): boolean {
  const k = e.key;
  return k === "MediaPlayPause" || k === "MediaPlay" || k === "MediaPause" || k === "ContextMenu" || e.keyCode === 179 || e.keyCode === 10252;
}

const KEY_DIRS: Record<string, DirName> = {
  arrowup: "up", w: "up",
  arrowdown: "down", s: "down",
  arrowleft: "left", a: "left",
  arrowright: "right", d: "right",
};

export function keyDir(e: KeyboardEvent): DirName | null {
  return KEY_DIRS[e.key.toLowerCase()] ?? null;
}

export function isConfirmKey(e: KeyboardEvent): boolean {
  return e.key === "Enter" || e.key === " " || e.key === "Select" || e.keyCode === 13;
}

/** True when the event originated from an editable field (e.g. the leaderboard name input). */
export function isTypingTarget(e: { target: EventTarget | null }): boolean {
  const el = e.target;
  if (!(el instanceof HTMLElement)) return false;
  return el.closest("input, textarea, select, [contenteditable='true']") !== null;
}

/** True when the platform is likely a TV (coarse pointer on a big, landscape screen, or a TV UA). */
export function autoTvMode(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if (/\b(Android TV|AFT[A-Z]|BRAVIA|SMART-TV|SmartTV|Tizen|Web0S|webOS|GoogleTV|Chromecast|Leanback)\b/i.test(ua)) return true;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const ratio = window.innerWidth / Math.max(1, window.innerHeight);
  return (coarse || noHover) && ratio >= 1.45 && window.innerWidth >= 1100;
}

/* ------------------------------------------------------------------ */
/* Back stack                                                          */
/* ------------------------------------------------------------------ */

type BackHandler = () => boolean | void;
const backStack: BackHandler[] = [];

/**
 * Fires the top-most back handler. Returns true when something consumed the
 * press (closed a modal, returned to a game menu, left a game). A `false`
 * result means we are at the hub root and the platform may exit the app.
 */
export function dispatchBack(): boolean {
  for (let i = backStack.length - 1; i >= 0; i--) {
    const handled = backStack[i]();
    if (handled !== false) return true;
  }
  return false;
}

/**
 * Register a back handler for as long as the component is mounted (and
 * `active`). The most recently registered active handler wins, which maps
 * naturally onto UI layering: modal > game > hub.
 */
export function useBackHandler(handler: BackHandler, active = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const fn: BackHandler = () => ref.current();
    backStack.push(fn);
    return () => {
      const i = backStack.indexOf(fn);
      if (i >= 0) backStack.splice(i, 1);
    };
  }, [active]);
}

/* ------------------------------------------------------------------ */
/* Input bus                                                           */
/* ------------------------------------------------------------------ */

export interface GlobalControls {
  onDir?: (d: DirName) => void;
  onPrimary?: () => void; // A / confirm
  onSecondary?: () => void; // B / flag / secondary
  onStart?: () => void; // Start / MediaPlayPause
  onBack?: () => void; // Deprecated: prefer useBackHandler
}

export interface Held {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** Latched rising edge — the game loop consumes it by clearing it. */
  fire: boolean;
}

const DEADZONE = 0.5;
const DIR_REPEAT_DELAY = 320;
const DIR_REPEAT_RATE = 110;
const POLL_MS = 40;

const subscribers = new Set<React.MutableRefObject<GlobalControls>>();
const heldListeners = new Set<(h: Held) => void>();

/** Snapshot of the gamepad's directional/fire state, merged across all connected pads. */
const padHeld: Held = { up: false, down: false, left: false, right: false, fire: false };

let installed = false;
let lastDir: DirName | null = null;
let dirSince = 0;
let dirLastFire = 0;
const prevButtons: Record<number, boolean> = {};

function emit<K extends keyof GlobalControls>(key: K, ...args: Parameters<NonNullable<GlobalControls[K]>>) {
  for (const s of subscribers) {
    const fn = s.current[key] as ((...a: unknown[]) => void) | undefined;
    fn?.(...args);
  }
}

/** Route a directional press: overlay menu first, then the game. */
export function routeDir(d: DirName) {
  sfx.unlock();
  if (activeMenu() && moveFocus(d)) {
    sfx.select();
    return true;
  }
  emit("onDir", d);
  return false;
}

/** Route a confirm press: focused menu control first, then the game. */
export function routePrimary() {
  sfx.unlock();
  if (activeMenu() && activateFocused()) return true;
  emit("onPrimary");
  return false;
}

export function routeStart() {
  sfx.unlock();
  emit("onStart");
}

export function routeSecondary() {
  sfx.unlock();
  emit("onSecondary");
}

export function routeBack(): boolean {
  sfx.unlock();
  if (dispatchBack()) return true;
  // Legacy per-game onBack (kept for third-party game defs).
  let any = false;
  for (const s of subscribers) {
    if (s.current.onBack) {
      s.current.onBack();
      any = true;
    }
  }
  return any;
}

function pollGamepads(now: number) {
  let pads: (Gamepad | null)[];
  try {
    pads = navigator.getGamepads();
  } catch {
    return;
  }
  let up = false, down = false, left = false, right = false;
  const pressed: Record<number, boolean> = { 0: false, 1: false, 2: false, 3: false, 8: false, 9: false };
  let anyPad = false;
  for (const gp of pads) {
    if (!gp) continue;
    anyPad = true;
    const b = gp.buttons;
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    up ||= !!b[12]?.pressed || ay < -DEADZONE;
    down ||= !!b[13]?.pressed || ay > DEADZONE;
    left ||= !!b[14]?.pressed || ax < -DEADZONE;
    right ||= !!b[15]?.pressed || ax > DEADZONE;
    for (const i of [0, 1, 2, 3, 8, 9]) pressed[i] ||= !!b[i]?.pressed;
  }
  if (!anyPad) return;

  const inMenu = !!activeMenu();
  padHeld.up = up;
  padHeld.down = down;
  padHeld.left = left;
  padHeld.right = right;
  if (pressed[0] && !prevButtons[0] && !inMenu) padHeld.fire = true;

  // Directional edge + hold-repeat.
  const dir: DirName | null = up ? "up" : down ? "down" : left ? "left" : right ? "right" : null;
  if (dir !== lastDir) {
    lastDir = dir;
    dirSince = now;
    dirLastFire = now;
    if (dir) routeDir(dir);
  } else if (dir && now - dirSince > DIR_REPEAT_DELAY && now - dirLastFire > DIR_REPEAT_RATE) {
    dirLastFire = now;
    routeDir(dir);
  }

  // Face buttons: edge-triggered only.
  const edge = (i: number) => pressed[i] && !prevButtons[i];
  if (edge(0)) routePrimary();
  if (edge(1) || edge(2)) routeSecondary();
  if (edge(9)) routeStart();
  if (edge(8) || edge(3)) routeBack();
  for (const i of [0, 1, 2, 3, 8, 9]) prevButtons[i] = pressed[i];
}

/**
 * Global capture-phase keyboard layer. Runs before any game listener so that
 * Back keys, media keys and menu navigation are handled in exactly one place.
 */
function onCaptureKeyDown(e: KeyboardEvent) {
  if (e.defaultPrevented) return;
  if (isBackKey(e)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    routeBack();
    return;
  }
  if (isStartKey(e)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    routeStart();
    return;
  }
  const menu = activeMenu();
  if (!menu) return;
  const dir = keyDir(e);
  if (dir && !(isTextField(e.target as Element | null) && (dir === "left" || dir === "right"))) {
    // WASD inside a text field is real typing.
    if (isTextField(e.target as Element | null) && !e.key.startsWith("Arrow")) return;
    if (moveFocus(dir)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      sfx.select();
    }
    return;
  }
  if (isConfirmKey(e) && !isTextField(e.target as Element | null)) {
    const current = document.activeElement;
    if (current && menu.contains(current)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      activateFocused();
    } else if (activeMenu()) {
      // Nothing focused yet: land on the primary action, let the game's own handler run too.
      activateFocused();
    }
  }
}

function onCaptureKeyUp(e: KeyboardEvent) {
  // Prevent the browser's native Space->click on keyup from double-firing.
  if (e.key === " " && activeMenu() && !isTextField(e.target as Element | null)) e.preventDefault();
}

/** Install the shared input layer once. Safe to call multiple times. */
export function installInput(): () => void {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;
  window.addEventListener("keydown", onCaptureKeyDown, true);
  window.addEventListener("keyup", onCaptureKeyUp, true);
  const stopAutofocus = installMenuAutofocus();
  const id = window.setInterval(() => {
    if ("getGamepads" in navigator) pollGamepads(performance.now());
    for (const l of heldListeners) l(padHeld);
  }, POLL_MS);
  return () => {
    installed = false;
    window.removeEventListener("keydown", onCaptureKeyDown, true);
    window.removeEventListener("keyup", onCaptureKeyUp, true);
    stopAutofocus();
    window.clearInterval(id);
  };
}

/**
 * Subscribe a game (or the hub) to normalised controller actions.
 * Directions and confirms are automatically diverted to an open overlay menu.
 */
export function useGamepad(c: GlobalControls) {
  const cbRef = useRef(c);
  cbRef.current = c;
  useEffect(() => {
    subscribers.add(cbRef);
    return () => {
      subscribers.delete(cbRef);
    };
  }, []);
}

/* ------------------------------------------------------------------ */
/* Held-state input for motion games                                   */
/* ------------------------------------------------------------------ */

const HOLD_DIRS = ["up", "down", "left", "right"] as const;
type HoldDir = (typeof HOLD_DIRS)[number];

/**
 * Continuous held-state input for motion games (Breakout, Invaders,
 * Asteroids, Pong): keyboard held keys, on-screen hold pads and the shared
 * gamepad snapshot are merged into one ref. `fire` is latched on the rising
 * edge of a tap and must be consumed by the game loop.
 */
export function useRemoteHeld(): {
  held: React.MutableRefObject<Held>;
  setManual: (k: HoldDir | "fire", v: boolean) => void;
} {
  const held = useRef<Held>({ up: false, down: false, left: false, right: false, fire: false });
  const manual = useRef<Record<HoldDir, boolean>>({ up: false, down: false, left: false, right: false });

  const setManual = (k: HoldDir | "fire", v: boolean) => {
    if (k === "fire") {
      if (v) held.current.fire = true;
      return;
    }
    manual.current[k] = v;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || e.defaultPrevented) return;
      sfx.unlock();
      const dir = keyDir(e);
      if (dir) {
        manual.current[dir] = true;
        e.preventDefault();
        return;
      }
      if ((e.key === " " || e.key === "Enter") && !activeMenu()) {
        held.current.fire = true;
        e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const dir = keyDir(e);
      if (dir) manual.current[dir] = false;
    };
    const reset = () => {
      manual.current = { up: false, down: false, left: false, right: false };
      held.current.fire = false;
    };
    const onVis = () => {
      if (document.hidden) reset();
    };
    const merge = (pad: Held) => {
      const h = held.current;
      h.up = pad.up || manual.current.up;
      h.down = pad.down || manual.current.down;
      h.left = pad.left || manual.current.left;
      h.right = pad.right || manual.current.right;
      if (pad.fire) {
        h.fire = true;
        pad.fire = false;
      }
    };
    heldListeners.add(merge);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      heldListeners.delete(merge);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return { held, setManual };
}
