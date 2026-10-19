// Deterministic world layout shared by the phase components and the morphing particle field.
// Everything is seeded so the particles land exactly on the geometry they turn into.

export type V3 = [number, number, number];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Z of the shared "city block": tree, blueprint, city and neural web all sit over it. */
export const CZ = -115;

/* ---------------- Phase 1: light → voice → running track ---------------- */

/** Where the light funnel touches down; the voice ripples and the track bend are centred here. */
export const ORIGIN: V3 = [0, 0.6, 0];
/** Height of the twisting light funnel. */
export const FUNNEL_H = 30;

/** The voice waveform: a band of particles across the beam. */
export const WAVE = { halfWidth: 18, y: 3.4 };

/**
 * The track: a bend (half circle on the +z side, centred on the beam) feeding two straights that
 * run toward -z. The camera runs lane 4: round the bend, then down the left straight.
 */
export const TRACK = { innerR: 9.5, laneW: 1.22, lines: 9, zEnd: -82 };
export const laneRadius = (k: number) => TRACK.innerR + k * TRACK.laneW;
export const TRACK_OUTER_R = laneRadius(TRACK.lines - 1);
export const RUN_R = TRACK.innerR + 3.5 * TRACK.laneW;
export const RUN_X = -RUN_R;

/** A point on lane line k at path parameter s in [0, 1]: bend for s < 0.45, left straight after. */
export function lanePoint(k: number, s: number): V3 {
  const r = laneRadius(k);
  if (s < 0.45) {
    const th = (s / 0.45) * Math.PI;
    return [r * Math.cos(th), 0.04, r * Math.sin(th)];
  }
  return [-r, 0.04, ((s - 0.45) / 0.55) * TRACK.zEnd];
}

/* ---------------- Phase 2: the algorithm plot ---------------- */

/**
 * A 3D analytic plot centred over the city block: an axes cage on a grid floor, a flowing wave
 * sheet of particles, and bar charts — one of which runs a real insertion sort as you scroll.
 */
export const PLOT = { halfX: 26, halfZ: 18, height: 30, frameY: 22, midY: 14 };

/** Wave-sheet surface shared by the plot and the particle field (u in [-1, 1], v in [0, 1]). */
export const SHEET_GLSL = /* glsl */ `
  vec3 sheetPoint(float u, float v, float t) {
    // Strands fan out on the left and bunch together on the right, like a twisting ribbon.
    float spread = mix(26.0, 5.0, smoothstep(-1.0, 1.0, u));
    float x = u * ${PLOT.halfX.toFixed(1)};
    float z = ${CZ.toFixed(1)} + (v - 0.5) * spread;
    float y = 13.0 + 8.0 * sin(u * 2.6 + v * 1.2 - t * 0.35) + 2.2 * sin(u * 1.1 - v * 2.2 + 0.7)
      + (v - 0.5) * 4.0 * cos(u * 2.6 - t * 0.35);
    return vec3(x, y, z);
  }
`;

export const SORT_BARS = 44;

/** Snapshots of an insertion sort over shuffled bar heights: one array per swap, plus the swapped pair. */
export const SORT = (() => {
  const r = rng(77);
  const sorted = Array.from({ length: SORT_BARS }, (_, i) => 2 + i * 0.5);
  const a = [...sorted];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const snapshots: number[][] = [[...a]];
  const swapped: number[] = [-1];
  for (let i = 1; i < a.length; i++) {
    for (let j = i; j > 0 && a[j - 1] > a[j]; j--) {
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      snapshots.push([...a]);
      swapped.push(j - 1);
    }
  }
  return { snapshots, swapped };
})();

export const STARS: V3[] = [-13.5, -4.5, 4.5, 13.5].map((x) => [x, 37, CZ - 4]);

/* ---------------- Phase 3/4: blueprint → city ---------------- */

export type Building = { x: number; z: number; w: number; d: number; h: number; glass: boolean; delay: number };

export const PILLAR = { x: 0, z: CZ, radius: 1.3, height: 18, towerHeight: 34 };

export const BUILDINGS: Building[] = (() => {
  const r = rng(42);
  const out: Building[] = [];
  const CELL = 8;
  for (let gx = -5; gx <= 5; gx++) {
    for (let gz = -5; gz <= 5; gz++) {
      if (gx === 0 || gz === 0) continue; // main avenue + cross street stay open
      const cx = gx * CELL;
      const cz = CZ + gz * CELL;
      const dist = Math.hypot(cx, cz - CZ);
      const centrality = Math.max(0, 1 - dist / 55);
      const height = () => 6 + r() * 10 + centrality * (10 + r() * 32);
      if (r() < 0.3) {
        for (const off of [-1.6, 1.6]) {
          out.push({ x: cx + off, z: cz, w: 2.6, d: 3.6 + r() * 2, h: height(), glass: r() < 0.45, delay: dist / 55 });
        }
      } else {
        out.push({ x: cx, z: cz, w: 3.6 + r() * 2.2, d: 3.6 + r() * 2.2, h: height(), glass: r() < 0.45, delay: dist / 55 });
      }
    }
  }
  // The blocks fronting the avenue rise higher, making a proper canyon; the sunward (left) side a
  // little less, so low sun can reach the right-hand facades.
  for (const b of out) if (Math.abs(b.x) < 12) b.h = b.x > 0 ? b.h * 1.35 + 8 : b.h * 1.1 + 4;
  return out;
})();

/**
 * Phase 4 backdrop: towers lining the avenue and the cross street out to the haze, so the streets
 * run to a real vanishing point. Rows hug the street edges; the core blocks above are left clear.
 */
export const SKYLINE: Building[] = (() => {
  const r = rng(77);
  const out: Building[] = [];
  const STEP = 11;
  const EDGE = 6;
  // Signed offsets from a street centre line: the first row sits right on the kerb.
  const offsets = (maxK: number) => Array.from({ length: maxK + 1 }, (_, k) => EDGE + 4.5 + k * STEP);
  for (const sx of [-1, 1]) {
    for (const ox of offsets(sx > 0 ? 29 : 14)) {
      const x = sx * ox;
      for (const sz of [-1, 1]) {
        for (const oz of offsets(sz < 0 ? 32 : 4)) {
          const z = CZ + sz * oz;
          if (Math.abs(x) < 47 && Math.abs(z - CZ) < 47) continue; // the core city
          const nearAvenue = Math.abs(x) < 60;
          const nearCross = Math.abs(z - CZ) < 60;
          if (!(nearAvenue && z < CZ) && !nearCross) continue; // only what the street views can see
          const kerb = ox < STEP + EDGE || oz < STEP + EDGE;
          const w = 6 + r() * 3.5;
          const d = 6 + r() * 3.5;
          const h = kerb ? 34 + r() * 52 : 16 + r() * 46;
          const dist = Math.hypot(x, z - CZ);
          out.push({ x: x - sx * (9 - w) / 2, z: z - sz * (9 - d) / 2, w, d, h, glass: r() < 0.42, delay: Math.min(1, dist / 300) });
        }
      }
    }
  }
  return out;
})();

/** Blueprint as line segments: footprints, plot grid, a ring around the pillar. `order` drives the draw-in. */
export const BLUEPRINT = (() => {
  const pos: number[] = [];
  const order: number[] = [];
  const y = 0.04;
  const seg = (x0: number, z0: number, x1: number, z1: number) => {
    pos.push(x0, y, z0, x1, y, z1);
    const o0 = Math.hypot(x0, z0 - CZ) / 62;
    const o1 = Math.hypot(x1, z1 - CZ) / 62;
    order.push(o0, o1);
  };
  for (const b of BUILDINGS) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
    seg(x0, z0, x1, z0);
    seg(x1, z0, x1, z1);
    seg(x1, z1, x0, z1);
    seg(x0, z1, x0, z0);
  }
  for (let i = -44; i <= 44; i += 8) {
    seg(i, CZ - 44, i, CZ + 44);
    seg(-44, CZ + i, 44, CZ + i);
  }
  for (const rad of [2.4, 3.4]) {
    const n = 48;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      seg(Math.cos(a0) * rad, CZ + Math.sin(a0) * rad, Math.cos(a1) * rad, CZ + Math.sin(a1) * rad);
    }
  }
  seg(-48, CZ, 48, CZ);
  seg(0, CZ - 48, 0, CZ + 48);
  return { positions: new Float32Array(pos), order: new Float32Array(order) };
})();

/** Light streams arcing across the avenue between towers, labelled with the stack. */
export const STREAMS: { label: string; points: V3[] }[] = (() => {
  const labels = ["Java", "Spring Boot", "PostgreSQL", "Infosys", "ACC"];
  const rows = [4, 3, 2, 1, -2];
  return labels.map((label, i) => {
    const gz = rows[i];
    const zA = CZ + gz * 8;
    const zB = zA - 6 + (i % 2) * 3;
    const yA = 7 + i * 1.6;
    const yB = 9 + ((i * 3) % 5) * 1.4;
    const side = i % 2 === 0 ? 1 : -1;
    return {
      label,
      points: [
        [-6 * side, yA, zA],
        [-2.5 * side, yA + 2.5, (zA * 2 + zB) / 3],
        [2.5 * side, yB + 2.5, (zA + zB * 2) / 3],
        [6 * side, yB, zB],
      ],
    };
  });
})();

/* ---------------- Phase 5: neural web ---------------- */

export const CORE: V3 = [0, 22, CZ];

export const NEURAL = (() => {
  const r = rng(99);
  const N = 200;
  const nodes: V3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const th = golden * i;
    const rad = 8 + r() * 18;
    nodes.push([CORE[0] + Math.cos(th) * ring * rad, CORE[1] + y * rad * 0.7, CORE[2] + Math.sin(th) * ring * rad]);
  }
  const pairs = new Set<string>();
  const links: [number, number][] = [];
  const d2 = (a: V3, b: V3) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  nodes.forEach((a, i) => {
    const nearest = nodes
      .map((b, j) => [j, d2(a, b)] as const)
      .filter(([j]) => j !== i)
      .sort((x, y) => x[1] - y[1])
      .slice(0, 3);
    for (const [j] of nearest) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!pairs.has(key)) {
        pairs.add(key);
        links.push([i, j]);
      }
    }
  });
  // Quadratic bezier per link (and some to the core), sampled into segments.
  const SAMPLES = 12;
  const curves: V3[][] = [];
  const bez = (a: V3, b: V3, bend: number) => {
    const m: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const len = Math.sqrt(d2(a, b));
    const c: V3 = [m[0] + (r() - 0.5) * len * bend, m[1] + (r() - 0.5) * len * bend, m[2] + (r() - 0.5) * len * bend];
    const pts: V3[] = [];
    for (let s = 0; s <= SAMPLES; s++) {
      const t = s / SAMPLES, u = 1 - t;
      pts.push([0, 1, 2].map((k) => u * u * a[k] + 2 * u * t * c[k] + t * t * b[k]) as V3);
    }
    return pts;
  };
  for (const [i, j] of links) curves.push(bez(nodes[i], nodes[j], 0.6));
  nodes.forEach((n, i) => {
    if (i % 6 === 0) curves.push(bez(CORE, n, 0.35));
  });
  const pos: number[] = [];
  const order: number[] = [];
  curves.forEach((pts) => {
    const o = r();
    for (let s = 0; s < pts.length - 1; s++) {
      pos.push(...pts[s], ...pts[s + 1]);
      order.push(o, o);
    }
  });
  return { nodes, curves, positions: new Float32Array(pos), order: new Float32Array(order) };
})();

/* ---------------- Phase 6: golden-hour city from a rooftop ---------------- */

/** Where the camera comes to rest: on a rooftop edge, looking out over the city at the sun. */
export const ROOFTOP_CAMERA: V3 = [-6.5, 42, -168];
export const ROOFTOP_LOOK: V3 = [4, 12, -600];
/** The rooftop the camera stands on: its top edge frames the bottom-left of the final shot. */
export const ROOFTOP = { x: -15, z: -177, w: 14, d: 14, h: 40 };

export type CityBlock = { x: number; z: number; w: number; d: number; h: number; tone: number };

/** A city that spreads to the horizon: mid-rises near the camera, a hazy skyline of towers far out. */
export const CITY: CityBlock[] = (() => {
  const r = rng(2026);
  const out: CityBlock[] = [];
  for (let i = 0; i < 2600; i++) {
    const t = Math.pow(r(), 1.5);
    const z = -186 - t * 820;
    const dist = -z - 180;
    const halfWidth = 50 + dist * 0.9;
    const x = (r() - 0.5) * 2 * halfWidth;
    // Keep the rooftop's own footprint clear.
    if (Math.abs(x - ROOFTOP.x) < 12 && z > -195) continue;
    const grow = 1 + dist / 350;
    const tower = z < -520 && Math.abs(x) < 260 && r() < 0.22;
    out.push({
      x,
      z,
      w: (7 + r() * 14) * grow * (tower ? 0.7 : 1),
      d: (7 + r() * 14) * grow * (tower ? 0.7 : 1),
      // Blocks stay well below the rooftop nearby and grow toward a modest skyline in the haze.
      h: tower ? 24 + r() * 30 : 4 + Math.pow(r(), 1.6) * (12 + dist * 0.035),
      tone: r(),
    });
  }
  return out;
})();

/** The HONEST SWEET dashboard floats just in front of the rooftop, off to the right of the sun. */
export const DASHBOARD_POS: V3 = [-2.5, 41, -179];

/* ---------------- Particle formations ---------------- */

/** Builds the 8 formations the particle field morphs through, one vec3 per particle each. */
export function buildFormations(count: number): { formations: Float32Array[]; rand: Float32Array } {
  const r = rng(1234);
  const formations = Array.from({ length: 8 }, () => new Float32Array(count * 3));
  const rand = new Float32Array(count);
  const set = (f: number, i: number, x: number, y: number, z: number) => {
    formations[f][i * 3] = x;
    formations[f][i * 3 + 1] = y;
    formations[f][i * 3 + 2] = z;
  };

  // Precompute sampling helpers.
  const bp = BLUEPRINT.positions;
  const bpSegs = bp.length / 6;
  const curveSegs = NEURAL.positions.length / 6;
  const surfaceArea = BUILDINGS.map((b) => (b.w + b.d) * 2 * b.h);
  const totalArea = surfaceArea.reduce((a, b) => a + b, 0);
  const pickBuilding = () => {
    let t = r() * totalArea;
    for (let k = 0; k < BUILDINGS.length; k++) {
      t -= surfaceArea[k];
      if (t <= 0) return BUILDINGS[k];
    }
    return BUILDINGS[BUILDINGS.length - 1];
  };

  for (let i = 0; i < count; i++) {
    rand[i] = r();

    // 0: a three-armed whirlpool of light on the ground around the funnel (spun in the shader)
    const rr0 = 0.8 + Math.pow(r(), 0.75) * 15;
    const a0 = (Math.floor(r() * 3) / 3) * Math.PI * 2 + Math.log(rr0) * 2.6 + (r() - 0.5) * 0.5;
    set(0, i, Math.cos(a0) * rr0, 0.12 + r() * 0.25, Math.sin(a0) * rr0);

    // 1: voice waveform. x across the band, y = signed amplitude slot in [-1, 1] (animated in the
    // shader), z = depth layer. A third of the particles sit on the outline for a crisp edge.
    const v = r() < 0.45 ? (r() < 0.5 ? -1 : 1) : (r() * 2 - 1);
    set(1, i, (r() * 2 - 1) * WAVE.halfWidth, v, (Math.floor(r() * 3) - 1) * 0.45 + (r() - 0.5) * 0.12);

    // 2: running-track lane lines: the bend, the left straight, and the right straight
    const k = Math.floor(r() * TRACK.lines);
    if (r() < 0.78) {
      const lp = lanePoint(k, r());
      set(2, i, lp[0], lp[1], lp[2]);
    } else {
      set(2, i, laneRadius(k), 0.04, r() * TRACK.zEnd);
    }

    // 3: the plot's wave sheet (u, v); positioned by SHEET_GLSL in the shader. Most particles sit on
    // discrete strands so the sheet reads as fine stippled lines.
    set(3, i, r() * 2 - 1, r() < 0.65 ? Math.floor(r() * 36) / 35 : r(), 0);

    // 4: blueprint lines
    const s = Math.floor(r() * bpSegs) * 6, t = r();
    set(4, i, bp[s] + (bp[s + 3] - bp[s]) * t, 0.06, bp[s + 2] + (bp[s + 5] - bp[s + 2]) * t);

    // 5: lit windows on the city's facades
    const b = pickBuilding();
    const face = Math.floor(r() * 4);
    const along = (Math.round(r() * 6) / 6 - 0.5) * (face % 2 === 0 ? b.w : b.d);
    const floorY = Math.round((0.05 + r() * 0.9) * b.h / 1.4) * 1.4;
    const fx = face === 1 ? b.w / 2 + 0.05 : face === 3 ? -b.w / 2 - 0.05 : along;
    const fz = face === 0 ? b.d / 2 + 0.05 : face === 2 ? -b.d / 2 - 0.05 : along;
    set(5, i, b.x + fx, floorY, b.z + fz);

    // 6: along the neural web's bezier curves
    const c = Math.floor(r() * curveSegs) * 6, u = r();
    const np = NEURAL.positions;
    set(6, i, np[c] + (np[c + 3] - np[c]) * u, np[c + 1] + (np[c + 4] - np[c + 1]) * u, np[c + 2] + (np[c + 5] - np[c + 2]) * u);

    // 7: the web blown outward and upward into the sunrise
    const ex = formations[6][i * 3] - CORE[0], ey = formations[6][i * 3 + 1] - CORE[1], ez = formations[6][i * 3 + 2] - CORE[2];
    set(7, i, CORE[0] + ex * 4, CORE[1] + ey * 3 + 30, CORE[2] + ez * 4);
  }
  return { formations, rand };
}
