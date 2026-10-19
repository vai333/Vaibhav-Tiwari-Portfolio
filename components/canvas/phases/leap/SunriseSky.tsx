"use client";

import * as THREE from "three";
import { keyed } from "@/lib/scroll";
import { SkyDome, type SkyPalette } from "../../SkyDome";

// Sun height above the horizon (radians) as the scroll ends, and how much of the night remains.
const SUN_ELEVATION: [number, number][] = [[0.84, -0.06], [0.92, 0.015], [1, 0.07]];
const NIGHT: [number, number][] = [[0.84, 1], [0.91, 0]];
const SUN_AZIMUTH_X = 0.05;
// A dusky-violet zenith falling through rose and peach to a gold horizon.
const PALETTE: SkyPalette = { zenith: "#5e5a86", high: "#a46a8c", mid: "#e8826f", low: "#ff9f5c" };

/** Shared with the scene's sun light so lighting matches the disc in the sky. */
export function sunDirection(p: number, out: THREE.Vector3) {
  const e = keyed(p, SUN_ELEVATION);
  return out.set(SUN_AZIMUTH_X, Math.sin(e), -Math.cos(e)).normalize();
}

const night = (p: number) => keyed(p, NIGHT);

/** The final golden-hour sky over the rooftop city. */
export function SunriseSky() {
  return <SkyDome palette={PALETTE} sun={sunDirection} night={night} />;
}
