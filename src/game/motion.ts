let cached: boolean | null = null;

/**
 * Cached check for prefers-reduced-motion. Ambient canvas effects
 * (motes, starfields, tongue flicker) skip themselves when true.
 */
export function prefersReducedMotion(): boolean {
  if (cached !== null) return cached;
  if (typeof window === "undefined" || !window.matchMedia) return false;
  cached = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return cached;
}