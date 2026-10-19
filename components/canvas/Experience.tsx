"use client";

import { Suspense, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { scroll, PHASE_COUNT } from "@/lib/scroll";
import type { Quality } from "@/lib/quality";
import { CameraRig } from "./CameraRig";
import { Atmosphere } from "./Atmosphere";
import { Floor } from "./Floor";
import { Flow } from "./Flow";
import { Starfield } from "./Starfield";
import { Effects } from "./Effects";
import { Drive } from "./phases/Drive";
import { Crucible } from "./phases/Crucible";
import { Foundation } from "./phases/Foundation";
import { Scale } from "./phases/Scale";
import { Pivot } from "./phases/Pivot";
import { Leap } from "./phases/Leap";

/**
 * Phases mount lazily, one ahead of the reader, and stay mounted once seen, so the first paint only
 * compiles what phase 1 needs.
 */
function useMountedPhases() {
  const [mounted, setMounted] = useState(2);
  const ref = useRef(2);
  useFrame(() => {
    const need = Math.min(PHASE_COUNT, Math.floor(scroll.progress * PHASE_COUNT) + 2);
    if (need > ref.current) {
      ref.current = need;
      setMounted(need);
    }
  });
  return mounted;
}

export function Experience({ quality }: { quality: Quality }) {
  const mounted = useMountedPhases();

  return (
    <>
      {/* Studio reflections for the metal and glass, generated locally (no HDR download). */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} color="#ffe1b0" position={[0, 6, -8]} scale={[12, 3, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[-8, 2, 4]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ffd4a3" position={[8, 3, 2]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer form="ring" intensity={2} color="#ffb060" position={[0, -4, 6]} scale={4} />
      </Environment>

      <Atmosphere />
      <CameraRig />
      <Starfield />
      <Floor />
      <Flow count={quality.particles} />

      {/* Each phase gets its own boundary so a suspending font load never blanks the scene. */}
      {mounted >= 1 && <Suspense fallback={null}><Drive funnelCount={quality.funnel} /></Suspense>}
      {mounted >= 2 && <Suspense fallback={null}><Crucible sheetCount={quality.sheet} /></Suspense>}
      {mounted >= 3 && <Suspense fallback={null}><Foundation /></Suspense>}
      {mounted >= 4 && <Suspense fallback={null}><Scale shadowMapSize={quality.shadowMapSize} /></Suspense>}
      {mounted >= 5 && <Suspense fallback={null}><Pivot /></Suspense>}
      {mounted >= 6 && <Suspense fallback={null}><Leap /></Suspense>}

      <Effects multisampling={quality.multisampling} />
    </>
  );
}
