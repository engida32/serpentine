import confetti from "canvas-confetti";

let reduced: boolean | null = null;

function prefersReducedMotion(): boolean {
  if (reduced === null) {
    reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return reduced;
}

/** Fire a confetti burst unless the user prefers reduced motion. */
export function burst(opts?: confetti.Options) {
  if (prefersReducedMotion()) return;
  confetti(opts);
}