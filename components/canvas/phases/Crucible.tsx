"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { range, scroll, smooth } from "@/lib/scroll";
import { CZ, PLOT, SHEET_GLSL, SORT, SORT_BARS, STARS, rng, type V3 } from "@/lib/layouts";
import { createRevealLineMaterial, getGlowTexture } from "../materials";

const { halfX: HX, halfZ: HZ } = PLOT;
const DECOR_BARS = 40;
const FONT = "/fonts/Geist-Regular.ttf";

/** Axes cage: grid floor, poles with ticks, box frame and cross braces. `order` draws it upward. */
function buildFrame() {
  const pos: number[] = [];
  const order: number[] = [];
  const nodes: V3[] = [];
  const seg = (a: V3, b: V3) => {
    pos.push(...a, ...b);
    const o = (p: V3) => 0.04 + 0.8 * (p[1] / 34) + 0.1 * (Math.hypot(p[0], p[2] - CZ) / 40);
    order.push(o(a), o(b));
  };
  const y0 = 0.06;
  for (let x = -30; x <= 30; x += 6) seg([x, y0, CZ - 22], [x, y0, CZ + 22]);
  for (let z = -22; z <= 22; z += 5.5) seg([-30, y0, CZ + z], [30, y0, CZ + z]);

  const corners: [number, number][] = [[-HX, -HZ], [HX, -HZ], [HX, HZ], [-HX, HZ]];
  for (const [x, z] of corners) {
    seg([x, 0, CZ + z], [x, PLOT.height, CZ + z]);
    for (let y = 4; y < PLOT.height; y += 4) seg([x - 0.35, y, CZ + z], [x + 0.35, y, CZ + z]);
    nodes.push([x, PLOT.frameY, CZ + z], [x, 0.1, CZ + z]);
  }
  const poles: [number, number, number][] = [[0, 0, 32], [-13, 4, 26], [13, -6, 24], [-4, 12, 18], [8, 10, 28]];
  for (const [x, z, h] of poles) {
    seg([x, 0, CZ + z], [x, h, CZ + z]);
    nodes.push([x, h, CZ + z]);
  }
  // Top frame, and braces from the central pole out to the sides at two heights.
  for (let k = 0; k < 4; k++) {
    const [x0, z0] = corners[k], [x1, z1] = corners[(k + 1) % 4];
    seg([x0, PLOT.frameY, CZ + z0], [x1, PLOT.frameY, CZ + z1]);
  }
  for (const y of [PLOT.midY, PLOT.frameY]) {
    seg([0, y, CZ], [HX, y, CZ]);
    seg([0, y, CZ], [-HX, y, CZ]);
    seg([0, y, CZ], [0, y, CZ + HZ]);
    seg([0, y, CZ], [0, y, CZ - HZ]);
    nodes.push([0, y, CZ], [HX, y, CZ], [-HX, y, CZ], [0, y, CZ + HZ], [0, y, CZ - HZ]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute("aOrder", new THREE.BufferAttribute(new Float32Array(order), 1));
  return { geo, nodes };
}

/** Fine dotted sub-grid on the floor. */
function buildFloorDots() {
  const pts: number[] = [];
  for (let x = -30; x <= 30; x += 1.5) for (let z = -22; z <= 22; z += 1.5) pts.push(x, 0.07, CZ + z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
  return geo;
}

function createSheet(count: number) {
  const r = rng(31);
  const uv = new Float32Array(count * 2);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    uv[i * 2] = r() * 2 - 1;
    uv[i * 2 + 1] = r() < 0.8 ? Math.floor(r() * 40) / 39 : r();
    seed[i] = r();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute("aUV", new THREE.BufferAttribute(uv, 2));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uSweep: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec2 aUV;
      attribute float aSeed;
      uniform float uTime, uSweep, uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;
      ${SHEET_GLSL}
      void main() {
        vec3 p = sheetPoint(aUV.x, aUV.y, uTime);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(uPixelRatio * (0.8 + aSeed * 0.9) * 40.0 / -mv.z, 4.5);
        // White stipple with a gold accent where the strands bunch on the right (cyan in the reference).
        vColor = mix(vec3(1.5, 1.5, 1.45), vec3(2.8, 1.6, 0.45), smoothstep(0.05, 0.75, aUV.x));
        float sweep = 1.0 - smoothstep(uSweep - 0.15, uSweep, aUV.x * 0.5 + 0.5);
        vAlpha = (0.55 + 0.45 * aSeed) * sweep;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.15, d) * vAlpha * uOpacity;
        if (!(a > 0.003)) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return { geo, mat };
}

/** One clean white curve riding above the sheet. */
function createCurve() {
  const N = 220;
  const u = new Float32Array(N);
  for (let i = 0; i < N; i++) u[i] = (i / (N - 1)) * 2 - 1;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute("aU", new THREE.BufferAttribute(u, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uSweep: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aU;
      uniform float uTime;
      varying float vU;
      ${SHEET_GLSL}
      void main() {
        vU = aU;
        vec3 p = sheetPoint(aU, 0.25, uTime * 0.8 + 0.6) + vec3(0.0, 3.0 * cos(aU * 1.4), 0.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity, uSweep;
      varying float vU;
      void main() {
        float a = uOpacity * (1.0 - smoothstep(uSweep - 0.1, uSweep, vU * 0.5 + 0.5));
        if (!(a > 0.003)) discard;
        gl_FragColor = vec4(vec3(1.9, 1.85, 1.75), a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Line(geo, mat);
}

/**
 * Phase 2: the algorithm plot. Lanes shatter into a flowing wave sheet inside a white axes cage;
 * a bar chart runs a real insertion sort (swapped bars glow gold) while four CodeChef stars lock in
 * above. In phase 3 the whole plot flattens onto the floor as the blueprint draws.
 */
export function Crucible({ sheetCount }: { sheetCount: number }) {
  const group = useRef<THREE.Group>(null);
  const plot = useRef<THREE.Group>(null);
  const starRefs = useRef<(THREE.Group | null)[]>([]);
  const labels = useRef<({ fillOpacity: number } | null)[]>([]);
  const nodesMesh = useRef<THREE.InstancedMesh>(null);
  const dpr = useThree((s) => s.viewport.dpr);

  const frame = useMemo(buildFrame, []);
  const frameMaterial = useMemo(() => createRevealLineMaterial("#f2ede4", 0.75), []);
  const floorDots = useMemo(buildFloorDots, []);
  const dotMaterial = useMemo(
    () => new THREE.PointsMaterial({ color: "#d9d4ca", size: 0.09, transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const sheet = useMemo(() => createSheet(sheetCount), [sheetCount]);
  const curve = useMemo(createCurve, []);
  const nodeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.1), transparent: true, opacity: 0, toneMapped: false }), []);
  const arrowMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#f2ede4", transparent: true, opacity: 0 }), []);

  // Bars: the sorting row (front right) and a decorative row (back left), drawn as glowing lines.
  const BAR_COUNT = SORT_BARS + DECOR_BARS;
  const bars = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BAR_COUNT * 6), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(BAR_COUNT * 6), 3).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 12, CZ), 60);
    const tops = new THREE.BufferGeometry();
    tops.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BAR_COUNT * 3), 3).setUsage(THREE.DynamicDrawUsage));
    tops.boundingSphere = geo.boundingSphere;
    return { geo, tops };
  }, [BAR_COUNT]);
  const barMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [],
  );
  const topMaterial = useMemo(() => new THREE.PointsMaterial({ color: "#ffffff", size: 0.28, transparent: true, opacity: 0, depthWrite: false }), []);

  const arrows: V3[] = useMemo(
    () => [[-HX, PLOT.height, CZ - HZ], [HX, PLOT.height, CZ - HZ], [HX, PLOT.height, CZ + HZ], [-HX, PLOT.height, CZ + HZ], [0, 32, CZ]],
    [],
  );
  const labelDefs: { text: string; pos: V3; size: number }[] = useMemo(
    () => [
      { text: "O(n log n)", pos: [0, 34, CZ], size: 1.2 },
      { text: "500+ DSA", pos: [-HX, PLOT.height + 2, CZ + HZ], size: 1.1 },
      { text: "300+ LEETCODE", pos: [HX, PLOT.height + 2, CZ + HZ], size: 1.1 },
      { text: "4-STAR CODECHEF", pos: [-HX, PLOT.height + 2, CZ - HZ], size: 1.1 },
      { text: "n", pos: [HX, PLOT.height + 2, CZ - HZ], size: 1.1 },
      { text: "100", pos: [HX + 1.4, 8, CZ + HZ], size: 0.7 },
      { text: "200", pos: [HX + 1.4, 16, CZ + HZ], size: 0.7 },
      { text: "300", pos: [HX + 1.4, 24, CZ + HZ], size: 0.7 },
    ],
    [],
  );

  const placedNodes = useRef(false);

  useFrame((state) => {
    const p = scroll.progress;
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    g.visible = p > 0.15 && p < 0.42;
    if (!g.visible) return;

    if (!placedNodes.current && nodesMesh.current) {
      const d = new THREE.Object3D();
      frame.nodes.forEach((n, i) => {
        d.position.set(...n);
        d.updateMatrix();
        nodesMesh.current!.setMatrixAt(i, d.matrix);
      });
      nodesMesh.current.instanceMatrix.needsUpdate = true;
      placedNodes.current = true;
    }

    const show = smooth(range(p, 0.17, 0.21));
    const vanish = smooth(range(p, 0.37, 0.41));
    const alpha = show * (1 - vanish);
    // Phase 3: the plot flattens onto the floor while the blueprint draws.
    const compress = smooth(range(p, 0.335, 0.385));
    if (plot.current) plot.current.scale.y = Math.max(0.02, 1 - compress * 0.98);

    frameMaterial.uniforms.uReveal.value = range(p, 0.17, 0.225);
    frameMaterial.uniforms.uOpacity.value = 1 - vanish;
    dotMaterial.opacity = alpha * 0.55;
    nodeMaterial.opacity = alpha;
    arrowMaterial.opacity = alpha;

    const sweep = range(p, 0.19, 0.24) * 1.2;
    const sm = sheet.mat.uniforms;
    sm.uTime.value = t;
    sm.uOpacity.value = alpha;
    sm.uSweep.value = sweep;
    sm.uPixelRatio.value = dpr;
    const cm = (curve.material as THREE.ShaderMaterial).uniforms;
    cm.uTime.value = t;
    cm.uOpacity.value = alpha;
    cm.uSweep.value = range(p, 0.2, 0.25) * 1.15;

    labels.current.forEach((l) => {
      if (l) l.fillOpacity = smooth(range(p, 0.215, 0.24)) * (1 - vanish);
    });

    // Bars rise, then the front row insertion-sorts itself; the pair being swapped glows gold.
    const rise = smooth(range(p, 0.2, 0.235));
    const steps = SORT.snapshots.length - 1;
    const s = range(p, 0.225, 0.305) * steps;
    const k0 = Math.floor(s), k1 = Math.min(steps, k0 + 1), f = s - k0;
    const a0 = SORT.snapshots[k0], a1 = SORT.snapshots[k1];
    const hot = s < steps ? SORT.swapped[k1] : -1;
    const pos = bars.geo.attributes.position.array as Float32Array;
    const col = bars.geo.attributes.color.array as Float32Array;
    const top = bars.tops.attributes.position.array as Float32Array;
    for (let i = 0; i < BAR_COUNT; i++) {
      let x: number, z: number, h: number, gold = false;
      if (i < SORT_BARS) {
        x = 3 + i * 0.5;
        z = CZ + 15;
        h = (a0[i] + (a1[i] - a0[i]) * f) * 0.95;
        gold = i === hot || i === hot + 1;
      } else {
        const j = i - SORT_BARS;
        x = -26 + j * 0.48;
        z = CZ - 14;
        h = 6 + 16 * (1 - j / DECOR_BARS) + 1.4 * Math.sin(t * 1.5 + j * 0.4);
      }
      h *= rise;
      const o = i * 6;
      pos[o] = x; pos[o + 1] = 0.05; pos[o + 2] = z;
      pos[o + 3] = x; pos[o + 4] = Math.max(0.06, h); pos[o + 5] = z;
      col[o] = col[o + 1] = col[o + 2] = 0.06;
      if (gold) {
        col[o + 3] = 2.8; col[o + 4] = 1.6; col[o + 5] = 0.5;
      } else {
        col[o + 3] = 1.35; col[o + 4] = 1.35; col[o + 5] = 1.3;
      }
      top[i * 3] = x; top[i * 3 + 1] = Math.max(0.06, h); top[i * 3 + 2] = z;
    }
    bars.geo.attributes.position.needsUpdate = true;
    bars.geo.attributes.color.needsUpdate = true;
    bars.tops.attributes.position.needsUpdate = true;
    barMaterial.opacity = alpha;
    topMaterial.opacity = alpha * rise;

    // Stars lock in one at a time above the plot, then lift away as the blueprint forms.
    starRefs.current.forEach((star, k) => {
      if (!star) return;
      const lock = smooth(range(p, 0.24 + k * 0.012, 0.26 + k * 0.012));
      const leave = smooth(range(p, 0.37, 0.42));
      const [sx, sy, sz] = STARS[k];
      star.position.set(sx, sy + (1 - lock) * 14 + leave * 30, sz);
      star.rotation.set(0, (1 - lock) * Math.PI * 3 + Math.sin(t * 0.8 + k) * 0.25, 0);
      star.scale.setScalar(Math.max(0.0001, lock * 0.8));
    });
  });

  const star = useMemo(starGeometry, []);

  return (
    <group ref={group} visible={false}>
      <group ref={plot}>
        <lineSegments geometry={frame.geo} material={frameMaterial} frustumCulled={false} />
        <points geometry={floorDots} material={dotMaterial} frustumCulled={false} />
        <instancedMesh ref={nodesMesh} args={[undefined, nodeMaterial, frame.nodes.length]} frustumCulled={false}>
          <sphereGeometry args={[0.22, 12, 12]} />
        </instancedMesh>
        {arrows.map((a, i) => (
          <mesh key={i} position={[a[0], a[1] + 0.5, a[2]]} material={arrowMaterial}>
            <coneGeometry args={[0.3, 1, 12]} />
          </mesh>
        ))}
        <points geometry={sheet.geo} material={sheet.mat} frustumCulled={false} />
        <primitive object={curve} frustumCulled={false} />
        <lineSegments geometry={bars.geo} material={barMaterial} frustumCulled={false} />
        <points geometry={bars.tops} material={topMaterial} frustumCulled={false} />
        {labelDefs.map((l, i) => (
          <Billboard key={l.text} position={l.pos}>
            <Text
              ref={(el: unknown) => {
                labels.current[i] = el as { fillOpacity: number } | null;
              }}
              font={FONT}
              fontSize={l.size}
              letterSpacing={0.06}
              color="#f4efe6"
              anchorX="center"
              anchorY="middle"
              fillOpacity={0}
            >
              {l.text}
            </Text>
          </Billboard>
        ))}
      </group>
      {STARS.map((_, k) => (
        <group
          key={k}
          ref={(el) => {
            starRefs.current[k] = el;
          }}
        >
          <mesh geometry={star}>
            <meshStandardMaterial color="#ffd27a" metalness={1} roughness={0.22} emissive="#ff9a2e" emissiveIntensity={0.9} />
          </mesh>
          <sprite scale={8}>
            <spriteMaterial map={getGlowTexture()} color="#ffb347" opacity={0.5} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
    </group>
  );
}

function starGeometry() {
  const shape = new THREE.Shape();
  const spikes = 5, outer = 2.2, inner = 0.92;
  for (let i = 0; i <= spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (spikes * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.14, bevelSegments: 3 });
  geo.center();
  return geo;
}
