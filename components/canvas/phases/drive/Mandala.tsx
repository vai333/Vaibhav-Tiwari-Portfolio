"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { keyed, scroll } from "@/lib/scroll";

// Overall brightness, voice-ripple strength, and how far the track has taken over.
const INTENSITY: [number, number][] = [[0, 1], [0.078, 1], [0.098, 0.12], [0.108, 0]];
const VOICE: [number, number][] = [[0, 0.2], [0.025, 0.35], [0.045, 0.75], [0.08, 0.75], [0.11, 0.25], [0.15, 0]];
const TRACK: [number, number][] = [[0, 0], [0.07, 0], [0.11, 1]];
// The whirlpool under the funnel; it gives way to the circuit traces once the voice starts.
const WHIRL: [number, number][] = [[0, 1], [0.03, 1], [0.06, 0.35], [0.1, 0]];
const CIRCUIT: [number, number][] = [[0, 0.3], [0.025, 0.45], [0.045, 1]];

/**
 * The ground the beam lands on: concentric glyph rings, Manhattan circuit traces and teal specks,
 * all procedural. While the voice speaks, golden ripples run outward and light the traces they cross.
 */
export function Mandala() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uVoice: { value: 0 }, uTrack: { value: 0 }, uWhirl: { value: 1 }, uCircuit: { value: 0.3 } },
        vertexShader: /* glsl */ `
          varying vec2 vP;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vP = wp.xz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime, uIntensity, uVoice, uTrack, uWhirl, uCircuit;
          varying vec2 vP;
          const float TAU = 6.28318530718;

          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float ringLine(float r, float R, float w) {
            float fw = fwidth(r) * 1.5;
            return 1.0 - smoothstep(w, w + fw, abs(r - R));
          }

          void main() {
            vec2 p = vP;
            float r = length(p);
            float a = atan(p.y, p.x);

            // Landing glyph: rings, a dashed ring and a band of ticks.
            float rings = 0.0;
            rings += ringLine(r, 1.4, 0.03);
            rings += ringLine(r, 2.0, 0.018) * 0.8;
            rings += ringLine(r, 2.8, 0.05) * 0.9;
            rings += ringLine(r, 4.2, 0.02) * 0.6;
            rings += ringLine(r, 5.2, 0.02) * 0.6;
            rings += ringLine(r, 6.4, 0.035) * 0.7;
            rings += ringLine(r, 7.6, 0.03) * step(0.5, fract(a / TAU * 72.0)) * 0.6;
            rings += ringLine(r, 11.0, 0.025) * 0.35;
            rings += ringLine(r, 16.5, 0.03) * 0.3;
            float u = a / TAU * 120.0;
            float tick = 1.0 - smoothstep(0.0, fwidth(u) * 1.2, abs(fract(u + 0.5) - 0.5) - 0.04);
            rings += tick * step(4.35, r) * step(r, 5.05) * 0.5;

            // Circuit traces on a square grid, plus solder nodes.
            vec2 cs = p / 1.4;
            vec2 id = floor(cs);
            vec2 q = fract(cs) - 0.5;
            float h = hash(id), h2 = hash(id + 17.3);
            float fq = fwidth(cs.x) * 1.2;
            float th = 1.0 - smoothstep(0.035, 0.035 + fq, abs(q.y));
            float tv = 1.0 - smoothstep(0.035, 0.035 + fq, abs(q.x));
            float trace = h < 0.42 ? th : (h < 0.8 ? tv : 0.0);
            if (h2 > 0.72) trace = max(trace, max(th * step(0.0, q.x), tv * step(0.0, q.y)));
            float node = (1.0 - smoothstep(0.11, 0.11 + fq, length(q))) * step(0.84, h2);

            // Spokes radiating from the landing point.
            float ang = (fract(a / TAU * 12.0 + 0.5) - 0.5) * (TAU / 12.0);
            float sd = abs(ang) * r;
            float spoke = (1.0 - smoothstep(0.025, 0.025 + fwidth(sd) * 1.5, sd)) * smoothstep(7.6, 9.0, r);

            float mask = smoothstep(2.9, 4.4, r) * exp(-r * 0.04);

            // Teal specks scattered like the stars above.
            vec2 cs2 = p / 0.8;
            vec2 id2 = floor(cs2);
            vec2 q2 = fract(cs2) - 0.5 - (vec2(hash(id2 + 1.0), hash(id2 + 2.0)) - 0.5) * 0.6;
            float speck = (1.0 - smoothstep(0.03, 0.08, length(q2))) * step(0.9, hash(id2 + 3.1));
            speck *= 0.55 + 0.45 * sin(uTime * (1.0 + hash(id2) * 3.0) + hash(id2) * 30.0);

            // Voice ripples travelling outward.
            float rip = 0.0;
            for (int i = 0; i < 4; i++) {
              float R = mod(uTime * 7.0 + float(i) * 14.0, 56.0);
              rip += exp(-pow(r - R, 2.0) * 0.35) * (1.0 - R / 56.0);
            }
            rip *= uVoice;

            vec3 gold = vec3(2.4, 1.45, 0.5);
            vec3 teal = vec3(0.25, 1.3, 1.45);
            // Whirlpool: three log-spiral arms of light winding into the funnel's base.
            float arms = pow(0.5 + 0.5 * sin(a * 3.0 - log(r + 0.4) * 6.5 + uTime * 2.4), 5.0);
            float whirl = arms * exp(-r * 0.15) * smoothstep(0.2, 1.4, r);
            float swirlRings = pow(0.5 + 0.5 * sin(r * 3.2 - uTime * 3.0 + a * 0.5), 8.0) * exp(-r * 0.2);

            vec3 col = gold * rings * 1.3 * (1.0 - uTrack * 0.6) * uCircuit;
            col += gold * (trace + node * 1.5 + spoke * 0.6) * mask * (0.2 * uCircuit + 1.5 * rip) * (1.0 - uTrack * 0.5);
            col += gold * (whirl * 2.2 + swirlRings * 0.8) * uWhirl;
            col += vec3(4.0, 2.6, 1.2) * exp(-r * r * 0.35) * 0.9 * uWhirl;
            col += teal * speck * 0.9 * smoothstep(1.5, 4.0, r);
            col += gold * rip * 0.25 * smoothstep(1.5, 3.0, r);
            col *= uIntensity * (1.0 - smoothstep(42.0, 68.0, r));
            if (max(col.r, max(col.g, col.b)) < 0.002) discard;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame((state) => {
    const p = scroll.progress;
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uIntensity.value = keyed(p, INTENSITY);
    u.uVoice.value = keyed(p, VOICE);
    u.uTrack.value = keyed(p, TRACK);
    u.uWhirl.value = keyed(p, WHIRL);
    u.uCircuit.value = keyed(p, CIRCUIT);
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} material={material} renderOrder={1}>
      <planeGeometry args={[140, 140]} />
    </mesh>
  );
}
