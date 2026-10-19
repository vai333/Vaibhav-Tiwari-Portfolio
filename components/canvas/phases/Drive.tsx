"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { scroll } from "@/lib/scroll";
import { Funnel } from "./drive/Funnel";
import { Clouds } from "../Clouds";
import { Mandala } from "./drive/Mandala";
import { Track } from "./drive/Track";
import { Streaks } from "./drive/Streaks";

/**
 * Phase 1: a twisting funnel of light touches down in a whirlpool among dark clouds (the source of light);
 * the voice speaks as a waveform and ripples across the floor; the ripples straighten into a
 * running track the camera sprints around, ending at the long-jump pit.
 */
const keepCameraLaneClear = (x: number, z: number) => Math.abs(x) < 9 && z > 6;

export function Drive({ funnelCount }: { funnelCount: number }) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    if (group.current) group.current.visible = scroll.progress < 0.23;
  });

  return (
    <group ref={group}>
      <Funnel count={funnelCount} />
      {/* Storm clouds round the funnel, with a clear sightline from the camera; they sink as the track forms. */}
      <Clouds center={[0, -6]} keepClear={keepCameraLaneClear} sink={[0.068, 0.1]} />
      <Mandala />
      <Track />
      <Streaks />
    </group>
  );
}
