"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { keyed, scroll } from "@/lib/scroll";
import { ROOFTOP_CAMERA, ROOFTOP_LOOK, type V3 } from "@/lib/layouts";

// Camera keyframes: [scroll progress, position, look-at target].
const KEYS: [number, V3, V3][] = [
  // Phase 1: look up the light funnel → the voice waveform → rise to see the ripples
  // straighten into the bend → sprint round lane 4 and down the straight → the leap
  [0.0, [0, 7, 54], [0, 14.5, 0]],
  [0.022, [0, 5, 37], [0, 9.5, 0]],
  [0.042, [0, 3.6, 21], [0, 4.4, 0]],
  [0.062, [0, 3.9, 18.5], [0, 4.3, 0]],
  [0.08, [7, 17, 27], [-4, 0, 1]],
  [0.095, [1.5, 1.05, 14.6], [-7, 0.8, 12.2]],
  [0.112, [-9.7, 0.95, 9.9], [-14.6, 0.8, 1.5]],
  [0.128, [-13.8, 0.85, -3], [-13.8, 0.8, -22]],
  [0.142, [-13.8, 0.8, -32], [-13.8, 0.75, -52]],
  [0.156, [-13.8, 0.85, -62], [-13.8, 0.8, -82]],
  [0.168, [-13.4, 2.2, -78], [-11, 3.5, -98]],
  [0.18, [-9, 7.5, -84], [-3, 9, -106]],
  // Phase 2: an elevated three-quarter view of the plot (like a 3D chart), circling slightly while
  // the bars sort; look targets sit screen-left of the plot so it stays clear of the story card.
  [0.215, [57.6, 47.6, -71], [-9.1, 14, -103.1]],
  [0.265, [46.8, 49.1, -63.5], [-11.1, 14, -104.6]],
  [0.31, [34.2, 52, -58.8], [-12, 17, -107.7]],
  // Phase 3: overhead blueprint → close on the pillar
  [0.36, [18, 30, -86], [0, 0, -115]],
  [0.42, [20, 13, -95], [0, 6, -115]],
  [0.475, [11, 7.5, -113], [0, 9, -115]],
  // Phase 4: as the towers rise, pull back down the avenue (staying in the street corridors) to street
  // level looking at the sun, then round the hub tower, along the cross street, up and out
  [0.5, [3.5, 8, -101], [0, 10, -140]],
  [0.53, [0.5, 1.5, -58], [0, 19, -140]],
  [0.57, [-0.6, 1.4, -84], [0.8, 17, -160]],
  [0.6, [2.8, 5, -111], [10, 6, -116]],
  [0.63, [18, 7, -115], [30, 9, -115]],
  [0.665, [28, 40, -115], [0, 12, -115]],
  // Phase 5: orbit the EZY SIGNAL core. Each look target is offset to screen-left of the core so the
  // core sits right of centre, clear of the story card.
  [0.71, [32, 32, -84], [-4.2, 22, -110.7]],
  [0.75, [-5, 28, -72], [-6, 22, -115.7]],
  [0.79, [-38, 22, -104], [-1.7, 22, -120.8]],
  [0.83, [-26, 24, -146], [4.6, 22, -118.8]],
  // Phase 6: rise out of the cloud sea onto a rooftop and settle looking over the city at the sun.
  [0.87, [-16, 34, -152], [0, 26, -320]],
  [0.93, [-8.5, 40.5, -163], [3, 16, -520]],
  [0.965, [-6.8, 41.8, -167], [4, 12.5, -590]],
  [1.0, [...ROOFTOP_CAMERA], [...ROOFTOP_LOOK]],
];

const FOV: [number, number][] = [
  [0, 50],
  [0.085, 50],
  [0.1, 60],
  [0.12, 70],
  [0.15, 76],
  [0.18, 55],
  [0.56, 55],
  [0.6, 64],
  [0.64, 55],
  [1, 48],
];

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const { posCurve, lookCurve, times } = useMemo(() => {
    const v = (p: V3) => new THREE.Vector3(...p);
    return {
      posCurve: new THREE.CatmullRomCurve3(KEYS.map((k) => v(k[1])), false, "centripetal"),
      lookCurve: new THREE.CatmullRomCurve3(KEYS.map((k) => v(k[2])), false, "centripetal"),
      times: KEYS.map((k) => k[0]),
    };
  }, []);

  const desiredPos = useRef(new THREE.Vector3());
  const desiredLook = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3(0, 0.6, 0));
  const offset = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const p = scroll.progress;
    // Map progress to the curve's parameter so each keyframe is hit at its own progress.
    const last = times.length - 1;
    let u = 1;
    for (let i = 1; i <= last; i++) {
      if (p <= times[i]) {
        u = (i - 1 + (p - times[i - 1]) / (times[i] - times[i - 1])) / last;
        break;
      }
    }
    u = Math.min(1, Math.max(0, u));
    posCurve.getPoint(u, desiredPos.current);
    // Never let spline overshoot take the camera through the ground.
    desiredPos.current.y = Math.max(desiredPos.current.y, 0.6);
    lookCurve.getPoint(u, desiredLook.current);

    // Subtle pointer parallax plus a slow idle drift when the scroll is at rest.
    const t = state.clock.elapsedTime;
    offset.current.set(state.pointer.x * 0.6 + Math.sin(t * 0.3) * 0.15, state.pointer.y * 0.35 + Math.cos(t * 0.25) * 0.1, 0);
    desiredPos.current.add(offset.current);

    const k = 1 - Math.exp(-6 * Math.min(delta, 0.1));
    camera.position.lerp(desiredPos.current, k);
    look.current.lerp(desiredLook.current, k);
    camera.lookAt(look.current);

    // Keyframes are framed for landscape; on narrow screens widen the vertical FOV to keep similar horizontal coverage.
    const aspect = state.size.width / state.size.height;
    const base = keyed(p, FOV);
    const fov =
      aspect >= 1.3
        ? base
        : Math.min(95, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base) / 2) * (1.3 / aspect) ** 0.75)));
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov += (fov - camera.fov) * k;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
