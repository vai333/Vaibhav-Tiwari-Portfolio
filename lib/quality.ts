export type Quality = {
  tier: "high" | "low";
  particles: number;
  funnel: number;
  sheet: number;
  dpr: [number, number];
  multisampling: number;
  /** Shadow map resolution for the street scene's sun. */
  shadowMapSize: number;
};

/** Cheap device heuristic: phones and low-core machines get fewer particles and softer shadows. */
export function detectQuality(): Quality {
  if (typeof window === "undefined") return high;
  const narrow = window.matchMedia("(max-width: 768px)").matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return narrow || coarse || cores <= 4 ? low : high;
}

const high: Quality = { tier: "high", particles: 9000, funnel: 9000, sheet: 26000, dpr: [1, 1.75], multisampling: 4, shadowMapSize: 2048 };
const low: Quality = { tier: "low", particles: 4000, funnel: 4000, sheet: 11000, dpr: [1, 1.25], multisampling: 0, shadowMapSize: 1024 };
