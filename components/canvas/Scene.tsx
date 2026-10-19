"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { detectQuality } from "@/lib/quality";
import { Experience } from "./Experience";

export default function Scene() {
  const [quality] = useState(detectQuality);
  const [dpr, setDpr] = useState(quality.dpr[1]);

  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ fov: 50, near: 0.1, far: 2000, position: [0, 1.2, 9] }}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      aria-hidden
    >
      {/* Drop resolution if the frame rate sags, raise it back when there's headroom. */}
      <PerformanceMonitor
        onDecline={() => setDpr(quality.dpr[0])}
        onIncline={() => setDpr(quality.dpr[1])}
        flipflops={3}
        onFallback={() => setDpr(quality.dpr[0])}
      />
      <AdaptiveDpr pixelated={false} />
      <Suspense fallback={null}>
        <Experience quality={quality} />
      </Suspense>
    </Canvas>
  );
}
