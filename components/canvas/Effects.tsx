"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode, type BloomEffect } from "postprocessing";
import { keyed, scroll } from "@/lib/scroll";

// Strong glow in the dark phases, gentle in daylight so the sky isn't blown out.
const BLOOM: [number, number][] = [[0, 1.5], [0.2, 1.3], [0.4, 1.1], [0.49, 1.0], [0.535, 0.35], [0.655, 0.35], [0.72, 1.6], [0.84, 1.4], [0.92, 0.3], [1, 0.26]];

export function Effects({ multisampling }: { multisampling: number }) {
  const bloom = useRef<BloomEffect>(null);

  useFrame(() => {
    if (bloom.current) bloom.current.intensity = keyed(scroll.progress, BLOOM);
  });

  return (
    <EffectComposer multisampling={multisampling} enableNormalPass={false}>
      <Bloom ref={bloom} mipmapBlur intensity={1.5} luminanceThreshold={0.62} luminanceSmoothing={0.2} radius={0.78} />
      <Vignette offset={0.28} darkness={0.62} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
