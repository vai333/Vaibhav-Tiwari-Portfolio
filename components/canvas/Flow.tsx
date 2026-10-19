"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { keyed, scroll } from "@/lib/scroll";
import { buildFormations, ORIGIN, SHEET_GLSL, WAVE } from "@/lib/layouts";

// Scroll progress → formation index (0 beam motes, 1 voice waveform, 2 lanes, 3 cloud, 4 blueprint, 5 city, 6 neural, 7 burst).
const MORPH: [number, number][] = [
  [0, 0], [0.012, 0], [0.04, 1], [0.068, 1], [0.1, 2], [0.17, 2], [0.215, 3], [0.33, 3], [0.38, 4],
  [0.47, 4], [0.535, 5], [0.665, 5], [0.725, 6], [0.84, 6], [0.93, 7], [1, 7],
];
// Dimmed to a faint sparkle on the windows while the street is in daylight.
const OPACITY: [number, number][] = [[0, 1], [0.49, 1], [0.535, 0.12], [0.655, 0.12], [0.7, 1], [0.84, 1], [0.93, 0]];
const SIZE: [number, number][] = [[0, 0.1], [0.035, 0.14], [0.07, 0.14], [0.1, 0.1], [0.14, 0.12], [0.2, 0.075], [0.33, 0.075], [0.4, 0.1], [0.5, 0.09], [0.7, 0.12], [1, 0.16]];

// Emissive colours per formation (values > 1 feed the bloom pass).
const COLORS = [
  [3.0, 2.2, 1.1], // white-gold light
  [3.4, 1.9, 0.55], // gold voice
  [2.7, 1.05, 0.4], // terracotta-gold lanes
  [1.7, 1.6, 1.4], // warm-white wave sheet
  [2.8, 1.85, 0.8], // pale-gold blueprint
  [2.5, 1.3, 0.45], // window amber
  [3.0, 1.6, 0.55], // neural gold
  [2.6, 1.7, 0.7], // sunrise gold
].map(([r, g, b]) => new THREE.Vector3(r, g, b));

/**
 * One draw call of N points that morphs through every phase. All 8 formations live in vertex
 * attributes; the vertex shader blends the current pair with a per-particle stagger.
 */
export function Flow({ count }: { count: number }) {
  const dpr = useThree((s) => s.viewport.dpr);

  const { geometry, material } = useMemo(() => {
    const { formations, rand } = buildFormations(count);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(formations[0], 3));
    for (let f = 1; f < 8; f++) geo.setAttribute(`aF${f}`, new THREE.BufferAttribute(formations[f], 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
    // Particles travel across the whole world; never frustum-cull them.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -100), 1e4);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMorph: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: 0.16 },
        uOpacity: { value: 1 },
        uPixelRatio: { value: 1 },
        uColors: { value: COLORS },
        uOrigin: { value: new THREE.Vector3(...ORIGIN) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aF1; attribute vec3 aF2; attribute vec3 aF3; attribute vec3 aF4;
        attribute vec3 aF5; attribute vec3 aF6; attribute vec3 aF7;
        attribute float aRand;
        uniform float uMorph, uTime, uSize, uPixelRatio;
        uniform vec3 uColors[8];
        uniform vec3 uOrigin;
        varying vec3 vColor;
        varying float vAlpha;

        const float WAVE_W = ${WAVE.halfWidth.toFixed(1)};
        const float WAVE_Y = ${WAVE.y.toFixed(1)};

        ${SHEET_GLSL}

        vec3 motes() {
          // The ground whirlpool: inner rings spin faster than the rim.
          float r = length(position.xz);
          float a = atan(position.z, position.x) + uTime * 0.6 + sin(uTime * 0.5) * 0.8 / (1.0 + r * 0.3);
          return vec3(cos(a) * r, position.y, sin(a) * r);
        }

        float speech(float x) {
          // A voice-like amplitude: a centred envelope, layered frequencies, and syllable pulses.
          float env = exp(-x * x / (WAVE_W * WAVE_W * 0.22));
          float carrier = abs(sin(x * 1.7 + uTime * 5.0) * 0.55 + sin(x * 0.63 - uTime * 3.1) * 0.3 + sin(x * 3.9 + uTime * 7.3) * 0.15);
          float syllable = 0.45 + 0.55 * pow(abs(sin(uTime * 2.1 + x * 0.12)), 0.6);
          return 0.05 + 5.2 * env * carrier * syllable;
        }

        vec3 wave() {
          float layer = 1.0 - abs(aF1.z) * 0.22;
          return vec3(aF1.x, WAVE_Y + aF1.y * speech(aF1.x) * layer, aF1.z);
        }

        vec3 formation(int i) {
          if (i == 0) return motes();
          if (i == 1) return wave();
          if (i == 2) return aF2;
          if (i == 3) return sheetPoint(aF3.x, aF3.y, uTime); // the plot's wave sheet
          if (i == 4) return aF4;
          if (i == 5) return aF5;
          if (i == 6) return aF6 + vec3(0.0, sin(uTime * 1.2 + aRand * 12.0) * 0.25, 0.0);
          return aF7;
        }

        void main() {
          float m = clamp(uMorph, 0.0, 7.0);
          int a = int(floor(m));
          int b = min(a + 1, 7);
          float f = m - float(a);
          // Staggered departure so formations dissolve and re-form rather than slide.
          float t = clamp((f - aRand * 0.35) / 0.65, 0.0, 1.0);
          t = t * t * (3.0 - 2.0 * t);

          vec3 p = mix(formation(a), formation(b), t);
          float flight = sin(t * 3.14159);
          p += vec3(
            sin(aRand * 41.0 + uTime * 1.3),
            cos(aRand * 23.0 + uTime * 1.1) * 0.6 + 0.4,
            sin(aRand * 17.0 - uTime * 0.9)
          ) * flight * 3.0;

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float size = uSize * (0.6 + aRand * 0.9) * (1.0 + flight * 0.8);
          gl_PointSize = min(size * uPixelRatio * 320.0 / -mv.z, 48.0);

          vColor = mix(uColors[a], uColors[b], t);
          float depthFade = 1.0 - smoothstep(90.0, 220.0, -mv.z);
          float edgeFade = 1.0;
          if (a == 1 || b == 1) {
            // Taper the waveform's ends into darkness.
            float e = 1.0 - smoothstep(WAVE_W * 0.55, WAVE_W, abs(p.x));
            edgeFade = mix(1.0, e, a == 1 ? 1.0 - t : t);
          }
          if (a == 0 && b == 0) edgeFade = 0.7;
          vAlpha = depthFade * edgeFade * (0.55 + aRand * 0.45);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float disc = smoothstep(0.5, 0.0, d);
          float a = disc * disc * vAlpha * uOpacity;
          if (a < 0.003) discard;
          gl_FragColor = vec4(vColor, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: geo, material: mat };
  }, [count]);

  useFrame((state) => {
    const p = scroll.progress;
    const u = material.uniforms;
    u.uMorph.value = keyed(p, MORPH);
    u.uTime.value = state.clock.elapsedTime;
    u.uOpacity.value = keyed(p, OPACITY);
    u.uSize.value = keyed(p, SIZE);
    u.uPixelRatio.value = dpr;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
