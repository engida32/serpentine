import type { DirName } from "../game/engine";

/**
 * Spatial (D-pad) focus navigation for overlay menus.
 *
 * Any visible element carrying `data-menu` is treated as a focus scope: the
 * shell routes D-pad / arrow presses to the geometrically nearest focusable
 * control inside the top-most scope, and confirm presses click the focused
 * control. Games therefore only have to tag their overlays with `data-menu`
 * (and optionally one control with `data-autofocus`) to become fully
 * remote-navigable — no per-game menu state required.
 */

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && style.pointerEvents !== "none";
}

/** The top-most visible `[data-menu]` scope, if any. Later in DOM order wins (modals render last). */
export function activeMenu(): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>("[data-menu]");
  for (let i = all.length - 1; i >= 0; i--) {
    if (isVisible(all[i])) return all[i];
  }
  return null;
}

export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
}

export function isTextField(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.matches("input:not([type=button]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable='true']");
}

/** Focus the preferred first control in a scope (`data-autofocus`, else the first focusable). */
export function focusInitial(root: HTMLElement): HTMLElement | null {
  const preferred = root.querySelector<HTMLElement>("[data-autofocus]");
  const target = preferred && isVisible(preferred) ? preferred : focusablesIn(root)[0];
  if (target) target.focus({ preventScroll: false });
  return target ?? null;
}

function center(r: DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Move focus one step in a direction. Returns true when a move happened or
 * the scope captured the press (so the game should not also act on it).
 */
export function moveFocus(dir: DirName): boolean {
  const root = activeMenu();
  if (!root) return false;
  const items = focusablesIn(root);
  if (items.length === 0) return false;

  const current = document.activeElement as HTMLElement | null;
  if (!current || !root.contains(current)) {
    focusInitial(root);
    return true;
  }

  // Let text fields keep horizontal caret movement.
  if (isTextField(current) && (dir === "left" || dir === "right")) return false;

  const from = center(current.getBoundingClientRect());
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of items) {
    if (el === current) continue;
    const c = center(el.getBoundingClientRect());
    const dx = c.x - from.x;
    const dy = c.y - from.y;
    let primary = 0;
    let secondary = 0;
    switch (dir) {
      case "up":
        primary = -dy;
        secondary = Math.abs(dx);
        break;
      case "down":
        primary = dy;
        secondary = Math.abs(dx);
        break;
      case "left":
        primary = -dx;
        secondary = Math.abs(dy);
        break;
      case "right":
        primary = dx;
        secondary = Math.abs(dy);
        break;
    }
    if (primary < 4) continue; // not in that direction
    // Favour controls that are aligned with the current one.
    const score = primary + secondary * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (best) {
    best.focus({ preventScroll: false });
    best.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
  // Even without a target we consumed the press: the menu owns directional input.
  return true;
}

/** Activate the focused control inside the active menu. Returns true when handled. */
export function activateFocused(): boolean {
  const root = activeMenu();
  if (!root) return false;
  const current = document.activeElement as HTMLElement | null;
  if (!current || !root.contains(current)) {
    // Nothing focused yet: land on the primary action instead of activating blindly.
    return focusInitial(root) !== null;
  }
  if (isTextField(current)) return false;
  current.click();
  return true;
}

/**
 * Keep focus inside newly-opened menus. Whenever a `[data-menu]` scope
 * appears (game over, pause, modal) and focus is not already inside it,
 * focus its preferred control so the very first D-pad press lands somewhere
 * sensible instead of on a hidden element.
 */
export function installMenuAutofocus(): () => void {
  let scheduled = 0;
  const sync = () => {
    scheduled = 0;
    const root = activeMenu();
    if (!root) return;
    const current = document.activeElement;
    if (current && root.contains(current)) return;
    focusInitial(root);
  };
  const obs = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = window.requestAnimationFrame(sync);
  });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-menu", "class", "style"] });
  sync();
  return () => {
    obs.disconnect();
    if (scheduled) window.cancelAnimationFrame(scheduled);
  };
}
