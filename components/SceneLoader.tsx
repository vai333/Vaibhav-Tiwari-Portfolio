"use client";

import dynamic from "next/dynamic";

// Three.js and the whole 3D experience load after the HTML, client-only.
const Scene = dynamic(() => import("./canvas/Scene"), { ssr: false });

export function SceneLoader() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[-1]" aria-hidden>
      <Scene />
    </div>
  );
}
