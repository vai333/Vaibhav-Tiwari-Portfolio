// Mutable scroll state shared between GSAP (writer) and the R3F render loop (reader).
// Kept outside React so scrolling never triggers a re-render.
export const scroll = {
  /** 0 → 1 across the six story sections, smoothed by ScrollTrigger's scrub. */
  progress: 0,
};

export const PHASE_COUNT = 6;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Maps p in [a, b] to [0, 1], clamped. */
export const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

/** Local progress inside phase i (0-based). */
export const phaseLocal = (p: number, i: number) => range(p, i / PHASE_COUNT, (i + 1) / PHASE_COUNT);

export const smooth = (t: number) => t * t * (3 - 2 * t);

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** 1 inside [a, b], ramping over `fade` on each side, 0 outside. */
export const window01 = (p: number, a: number, b: number, fade = 0.03) =>
  smooth(range(p, a - fade, a)) * (1 - smooth(range(p, b, b + fade)));

/** Piecewise-linear lookup over sorted [p, value] keys. */
export function keyed(p: number, keys: readonly (readonly [number, number])[]): number {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [p1, v1] = keys[i];
    if (p <= p1) {
      const [p0, v0] = keys[i - 1];
      return v0 + (v1 - v0) * ((p - p0) / (p1 - p0));
    }
  }
  return keys[keys.length - 1][1];
}

/** Current phase index for the 2D overlay; subscribed to with useSyncExternalStore. */
let currentPhase = 0;
const phaseListeners = new Set<() => void>();
export const phaseStore = {
  get: () => currentPhase,
  set(next: number) {
    if (next === currentPhase) return;
    currentPhase = next;
    phaseListeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    phaseListeners.add(listener);
    return () => phaseListeners.delete(listener);
  },
};
