"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { range, scroll, smooth } from "@/lib/scroll";
import { CORE, CZ, NEURAL, rng } from "@/lib/layouts";
import { createRevealLineMaterial, getGlowTexture, lineGeometry } from "../materials";
import { Clouds } from "../Clouds";

const N = NEURAL.nodes.length;
const JITTER = (() => {
  const r = rng(3);
  return NEURAL.nodes.map(() => r());
})();

/** Phase 5: the city melts into a neural web wired with bezier curves around the pulsing EZY SIGNAL core. */
export function Pivot() {
  const group = useRef<THREE.Group>(null);
  const nodes = useRef<THREE.InstancedMesh>(null);
  const core = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const web = useMemo(() => lineGeometry(NEURAL.positions, NEURAL.order), []);
  const webMaterial = useMemo(() => createRevealLineMaterial("#ffb04a", 1.1), []);
  const nodeGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.28, 1), []);

  useFrame((state) => {
    const p = scroll.progress;
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    g.visible = p > 0.66 && p < 0.95;
    if (!g.visible) return;

    const expand = smooth(range(p, 0.84, 0.93));

    if (nodes.current) {
      for (let i = 0; i < N; i++) {
        const n = NEURAL.nodes[i];
        const appear = smooth(range(p, 0.68 + JITTER[i] * 0.04, 0.715 + JITTER[i] * 0.04));
        const spread = 1 + expand * 3;
        const breathe = Math.sin(t * 1.2 + i * 0.37) * 0.25;
        dummy.position.set(
          CORE[0] + (n[0] - CORE[0]) * spread,
          CORE[1] + (n[1] - CORE[1]) * spread + breathe + expand * 25,
          CORE[2] + (n[2] - CORE[2]) * spread,
        );
        dummy.scale.setScalar(Math.max(0.0001, appear * (1 - expand) * (0.8 + JITTER[i] * 0.6)));
        dummy.updateMatrix();
        nodes.current.setMatrixAt(i, dummy.matrix);
      }
      nodes.current.instanceMatrix.needsUpdate = true;
    }

    webMaterial.uniforms.uReveal.value = range(p, 0.69, 0.765);
    webMaterial.uniforms.uOpacity.value = 0.8 * (1 - smooth(range(p, 0.84, 0.885)));

    // The core: fades up with the web, pulses like a heartbeat, then flares out at sunrise.
    const coreIn = smooth(range(p, 0.69, 0.735)) * (1 - expand);
    const beat = 1 + Math.pow(Math.max(0, Math.sin(t * 2.4)), 6) * 0.22;
    if (core.current) {
      core.current.scale.setScalar(Math.max(0.0001, coreIn * beat));
      core.current.rotation.y = t * 0.2;
    }
    if (shell.current) shell.current.rotation.set(t * 0.31, t * 0.47, 0);
  });

  return (
    <group ref={group} visible={false}>
      <instancedMesh ref={nodes} args={[nodeGeometry, undefined, N]} frustumCulled={false}>
        <meshBasicMaterial color={[3.2, 1.9, 0.6]} toneMapped={false} />
      </instancedMesh>
      <lineSegments geometry={web} material={webMaterial} frustumCulled={false} />
      <group position={CORE}>
        <group ref={core}>
          <mesh>
            <sphereGeometry args={[2.1, 48, 48]} />
            <meshBasicMaterial color={[7, 4.8, 2.2]} toneMapped={false} />
          </mesh>
          <mesh ref={shell}>
            <icosahedronGeometry args={[3.4, 1]} />
            <meshBasicMaterial color={[3, 1.7, 0.5]} wireframe transparent opacity={0.55} toneMapped={false} />
          </mesh>
          <sprite scale={16}>
            <spriteMaterial map={getGlowTexture()} color="#ffb85c" opacity={0.85} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      </group>
      {/* As the city melts, a sea of storm clouds billows up beneath the core and catches its light. */}
      <Clouds center={[0, CZ]} innerRadius={4} outerRadius={60} clusters={60} seed={515} rise={[0.67, 0.72]} sink={[0.84, 0.9]} />
    </group>
  );
}
