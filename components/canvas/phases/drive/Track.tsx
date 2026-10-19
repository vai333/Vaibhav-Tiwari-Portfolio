"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { range, scroll, smooth } from "@/lib/scroll";
import { laneRadius, lanePoint, RUN_X, TRACK, TRACK_OUTER_R } from "@/lib/layouts";
import { createRevealLineMaterial } from "../../materials";

const SURFACE_PAD = 0.35;
const LINE_HALF_W = 0.036;

/** Lane lines (drawn in the runner's direction), the terracotta surface, start line and long-jump pit. */
export function Track() {
  const surfaces = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  // Lane markings as flat painted strips (two triangles per segment) so they hold up at low angles.
  const lines = useMemo(() => {
    const pos: number[] = [];
    const order: number[] = [];
    const push = (a: number[], b: number[], oa: number, ob: number) => {
      const dx = b[0] - a[0], dz = b[2] - a[2];
      const len = Math.hypot(dx, dz) || 1;
      const nx = (-dz / len) * LINE_HALF_W, nz = (dx / len) * LINE_HALF_W;
      const a0 = [a[0] - nx, a[1], a[2] - nz], a1 = [a[0] + nx, a[1], a[2] + nz];
      const b0 = [b[0] - nx, b[1], b[2] - nz], b1 = [b[0] + nx, b[1], b[2] + nz];
      pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
      order.push(oa, ob, oa, oa, ob, ob);
    };
    for (let k = 0; k < TRACK.lines; k++) {
      // Bend + left straight, ordered along the run.
      const SEG = 120;
      for (let s = 0; s < SEG; s++) {
        const s0 = s / SEG, s1 = (s + 1) / SEG;
        push(lanePoint(k, s0), lanePoint(k, s1), s0 * 0.95, s1 * 0.95);
      }
      // Right straight, drawn alongside.
      const r = laneRadius(k);
      for (let s = 0; s < 40; s++) {
        const z0 = (s / 40) * TRACK.zEnd, z1 = ((s + 1) / 40) * TRACK.zEnd;
        push([r, 0.04, z0], [r, 0.04, z1], 0.2 + 0.7 * (z0 / TRACK.zEnd), 0.2 + 0.7 * (z1 / TRACK.zEnd));
      }
    }
    // Start line across the left straight, take-off board and sand pit.
    const y = 0.04;
    push([-TRACK.innerR, y, -2], [-TRACK_OUTER_R, y, -2], 0.5, 0.5);
    const pit: [number, number, number, number][] = [
      [RUN_X - 1.2, -84, RUN_X + 1.2, -84],
      [RUN_X - 1.6, -86, RUN_X + 1.6, -86],
      [RUN_X + 1.6, -86, RUN_X + 1.6, -96],
      [RUN_X + 1.6, -96, RUN_X - 1.6, -96],
      [RUN_X - 1.6, -96, RUN_X - 1.6, -86],
    ];
    for (const [x0, z0, x1, z1] of pit) push([x0, y, z0], [x1, y, z1], 0.96, 0.97);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute("aOrder", new THREE.BufferAttribute(new Float32Array(order), 1));
    return geo;
  }, []);
  const lineMaterial = useMemo(() => {
    const m = createRevealLineMaterial("#ffd29a", 1.2);
    m.side = THREE.DoubleSide;
    return m;
  }, []);

  const straightW = TRACK_OUTER_R - TRACK.innerR + SURFACE_PAD * 2;
  const straightX = (TRACK_OUTER_R + TRACK.innerR) / 2;

  useFrame(() => {
    const p = scroll.progress;
    lineMaterial.uniforms.uReveal.value = range(p, 0.07, 0.118);
    lineMaterial.uniforms.uOpacity.value = 1 - smooth(range(p, 0.17, 0.205));
    const surface = smooth(range(p, 0.075, 0.11)) * (1 - smooth(range(p, 0.175, 0.21)));
    surfaces.current.forEach((m) => {
      if (m) m.opacity = surface;
    });
  });

  const surfaceMaterial = (i: number) => (
    <meshStandardMaterial
      ref={(m) => {
        surfaces.current[i] = m;
      }}
      color="#1e0905"
      emissive="#6a2412"
      emissiveIntensity={0.16}
      roughness={0.3}
      metalness={0.35}
      envMapIntensity={0.5}
      transparent
      opacity={0}
      depthWrite={false}
    />
  );

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
        <ringGeometry args={[TRACK.innerR - SURFACE_PAD, TRACK_OUTER_R + SURFACE_PAD, 96, 1, Math.PI, Math.PI]} />
        {surfaceMaterial(0)}
      </mesh>
      {[-1, 1].map((side, i) => (
        <mesh key={side} rotation-x={-Math.PI / 2} position={[side * straightX, 0.01, TRACK.zEnd / 2]}>
          <planeGeometry args={[straightW, -TRACK.zEnd]} />
          {surfaceMaterial(i + 1)}
        </mesh>
      ))}
      <mesh geometry={lines} material={lineMaterial} frustumCulled={false} renderOrder={2} />
    </group>
  );
}
