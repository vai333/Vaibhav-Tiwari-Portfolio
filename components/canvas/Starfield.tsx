"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { keyed, scroll } from "@/lib/scroll";
import { rng } from "@/lib/layouts";

// Faint under the storm haze, full once the track run begins.
const OPACITY: [number, number][] = [[0, 0.25], [0.08, 0.5], [0.12, 1], [0.49, 1], [0.53, 0], [0.67, 0], [0.71, 1], [0.84, 1], [0.9, 0]];

/** Sparse white and teal stars on a far sphere that follows the camera. */
export function Starfield({ count = 2200 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);
  const dpr = useThree((s) => s.viewport.dpr);

  const { geometry, material } = useMemo(() => {
    const r = rng(9);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      // Bias toward the upper hemisphere; the floor hides most of the lower one anyway.
      pos.set([Math.cos(th) * s * 600, Math.abs(u) * 600 * (r() < 0.85 ? 1 : -0.3), Math.sin(th) * s * 600], i * 3);
      seed[i] = r();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uPixelRatio: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (1.0 + aSeed * aSeed * 2.4) * uPixelRatio;
          vColor = aSeed > 0.82 ? vec3(0.45, 1.5, 1.6) : vec3(1.3, 1.25, 1.15);
          vAlpha = (0.35 + 0.65 * aSeed) * (0.7 + 0.3 * sin(uTime * (0.6 + aSeed * 2.0) + aSeed * 50.0));
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d) * vAlpha * uOpacity;
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
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uOpacity.value = keyed(scroll.progress, OPACITY);
    material.uniforms.uPixelRatio.value = dpr;
    points.current?.position.copy(state.camera.position);
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} renderOrder={-2} />;
}
