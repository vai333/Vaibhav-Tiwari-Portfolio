"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { keyed, range, scroll, smooth, window01 } from "@/lib/scroll";
import { CORE, CZ, ORIGIN, STARS } from "@/lib/layouts";

type ColorKey = readonly [number, string];

const BG: ColorKey[] = [
  [0.0, "#0a0c11"], // misty slate under the storm
  [0.06, "#07080c"],
  [0.12, "#030408"],
  [0.16, "#04050c"],
  [0.21, "#060608"], // near-black plotting space
  [0.33, "#070607"],
  [0.4, "#0b0805"], // blueprint: deep umber
  [0.49, "#0b0805"],
  [0.535, "#b98f6e"], // street at golden hour: warm haze down the avenue
  [0.655, "#b98f6e"],
  [0.7, "#0a0806"],
  [0.83, "#0c0907"],
  [0.9, "#c98a6a"], // golden-hour haze (also the sky's horizon colour)
  [1.0, "#efa476"],
];

const FOG_NEAR: [number, number][] = [[0, 26], [0.09, 20], [0.15, 14], [0.22, 20], [0.36, 30], [0.49, 25], [0.535, 70], [0.655, 70], [0.7, 30], [0.85, 60], [1, 130]];
const FOG_FAR: [number, number][] = [[0, 120], [0.09, 110], [0.15, 100], [0.22, 150], [0.36, 230], [0.49, 170], [0.535, 460], [0.655, 460], [0.7, 190], [0.85, 500], [1, 980]];
const AMBIENT: [number, number][] = [[0, 0.08], [0.2, 0.15], [0.36, 0.25], [0.5, 0.35], [0.66, 0.3], [0.72, 0.12], [0.85, 0.15], [1, 0.1]];
// Warm light at the funnel base: strong enough to rim-light the clouds, then calmer for the track.
const CENTER: [number, number][] = [[0, 900], [0.05, 700], [0.085, 120], [0.13, 90], [0.18, 0]];
const ENV: [number, number][] = [[0, 0.5], [0.45, 0.9], [0.55, 1.4], [0.66, 1.2], [0.72, 0.4], [0.86, 0.6], [1, 0.4]];

/** Precompute keyed colors once; lerp between neighbours each frame. */
function useColorKeys(keys: ColorKey[]) {
  return useMemo(() => keys.map(([p, c]) => [p, new THREE.Color(c)] as const), [keys]);
}

function lerpColorKeys(p: number, keys: readonly (readonly [number, THREE.Color])[], out: THREE.Color) {
  if (p <= keys[0][0]) return out.copy(keys[0][1]);
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const t = (p - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
      return out.copy(keys[i - 1][1]).lerp(keys[i][1], t);
    }
  }
  return out.copy(keys[keys.length - 1][1]);
}

/** Background, fog, ambient light and the scene-wide accent lights, all driven by scroll. */
export function Atmosphere() {
  const scene = useThree((s) => s.scene);
  const bgKeys = useColorKeys(BG);
  const bg = useMemo(() => new THREE.Color("#03040a"), []);
  const fog = useMemo(() => new THREE.Fog("#03040a", 8, 70), []);

  const ambient = useRef<THREE.AmbientLight>(null);
  const center = useRef<THREE.PointLight>(null);
  const stars = useRef<(THREE.PointLight | null)[]>([]);
  const spot = useRef<THREE.SpotLight>(null);
  const core = useRef<THREE.PointLight>(null);
  const spotTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0, CZ);
    return o;
  }, []);

  useEffect(() => {
    scene.background = bg;
    scene.fog = fog;
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, bg, fog]);

  useFrame((state) => {
    const p = scroll.progress;
    const t = state.clock.elapsedTime;
    lerpColorKeys(p, bgKeys, bg);
    fog.color.copy(bg);
    fog.near = keyed(p, FOG_NEAR);
    fog.far = keyed(p, FOG_FAR);
    scene.environmentIntensity = keyed(p, ENV);

    if (ambient.current) ambient.current.intensity = keyed(p, AMBIENT);
    if (center.current) center.current.intensity = keyed(p, CENTER) * (1 + Math.sin(t * 4) * 0.12);

    // Stars lock in one by one during phase 2 and light the graph below.
    stars.current.forEach((light, k) => {
      if (!light) return;
      const lock = smooth(range(p, 0.24 + k * 0.012, 0.26 + k * 0.012));
      light.intensity = lock * (1 - smooth(range(p, 0.36, 0.42))) * 900;
    });

    if (spot.current) spot.current.intensity = window01(p, 0.38, 0.52, 0.04) * 5000;
    if (core.current) core.current.intensity = window01(p, 0.69, 0.84, 0.04) * (1500 + Math.sin(t * 2.4) * 400);
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.08} />
      <pointLight ref={center} position={ORIGIN} color="#ffb85c" intensity={40} distance={0} decay={2} />
      {STARS.map((pos, k) => (
        <pointLight
          key={k}
          ref={(el) => {
            stars.current[k] = el;
          }}
          position={[pos[0], pos[1] - 4, pos[2]]}
          color="#ffc46b"
          intensity={0}
          decay={2}
        />
      ))}
      <primitive object={spotTarget} />
      <spotLight
        ref={spot}
        position={[0, 48, CZ]}
        target={spotTarget}
        angle={0.24}
        penumbra={0.7}
        color="#ffd9a0"
        intensity={0}
        decay={2}
      />
      <pointLight ref={core} position={CORE} color="#ffb347" intensity={0} decay={2} />
    </>
  );
}
