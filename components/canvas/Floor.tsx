"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { keyed, scroll } from "@/lib/scroll";
import { CZ } from "@/lib/layouts";

const GRID: [number, number][] = [[0, 0], [0.17, 0], [0.32, 0], [0.38, 0.32], [0.49, 0.3], [0.53, 0], [0.67, 0], [0.75, 0.25], [0.84, 0.15], [0.88, 0]];
const OPACITY: [number, number][] = [[0, 1], [0.84, 1], [0.9, 0]];

/** A vast dark floor with an anti-aliased shader grid; the grid peaks during the blueprint phase. */
export function Floor() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uBase: { value: new THREE.Color("#070605") },
            uLine: { value: new THREE.Color("#ffa63d").multiplyScalar(1.2) },
            uGrid: { value: 0.12 },
            uOpacity: { value: 1 },
            uCenter: { value: new THREE.Vector2(0, CZ) },
          },
        ]),
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          #include <fog_pars_vertex>
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            vec4 mvPosition = viewMatrix * wp;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uBase;
          uniform vec3 uLine;
          uniform float uGrid;
          uniform float uOpacity;
          uniform vec2 uCenter;
          varying vec3 vWorld;
          #include <fog_pars_fragment>
          float grid(vec2 p, float size) {
            vec2 q = p / size;
            vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
            return 1.0 - min(min(g.x, g.y), 1.0);
          }
          void main() {
            vec2 p = vWorld.xz;
            float minor = grid(p, 2.0) * 0.35;
            float major = grid(p, 8.0);
            float d = length(p - uCenter);
            float pool = exp(-d * d / 2500.0);
            vec3 col = uBase + uLine * (minor + major) * uGrid * (0.35 + pool);
            col += uLine * pool * 0.04 * uGrid;
            gl_FragColor = vec4(col, uOpacity);
            #include <fog_fragment>
          }
        `,
        fog: true,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  useFrame(() => {
    const p = scroll.progress;
    material.uniforms.uGrid.value = keyed(p, GRID);
    material.uniforms.uOpacity.value = keyed(p, OPACITY);
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, -100]} material={material} renderOrder={-1}>
      <planeGeometry args={[1600, 1600]} />
    </mesh>
  );
}
