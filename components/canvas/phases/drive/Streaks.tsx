"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { scroll, window01 } from "@/lib/scroll";
import { rng, RUN_X, TRACK } from "@/lib/layouts";

const COUNT = 90;

/** Gold light trails rushing past along the straight while the camera sprints. */
export function Streaks() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.CylinderGeometry(0.022, 0.022, 1, 5, 1, true).rotateX(Math.PI / 2), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `
          varying float vT;
          varying float vSeed;
          void main() {
            vT = uv.y;
            vSeed = float(gl_InstanceID);
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime, uOpacity;
          varying float vT;
          varying float vSeed;
          void main() {
            float phase = fract(vT * 1.5 - uTime * (1.4 + fract(vSeed * 0.618) * 1.6) + vSeed * 0.37);
            float head = pow(phase, 7.0);
            vec3 col = mix(vec3(2.8, 1.6, 0.5), vec3(2.6, 0.9, 0.35), fract(vSeed * 0.381)) * (0.25 + head * 4.5);
            float a = uOpacity * (0.12 + head) * smoothstep(0.0, 0.1, vT) * smoothstep(1.0, 0.9, vT);
            gl_FragColor = vec4(col, a);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(() => {
    const r = rng(21);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < COUNT; i++) {
      const side = r() < 0.5 ? -1 : 1;
      const len = 6 + r() * 14;
      dummy.position.set(RUN_X + side * (2.5 + r() * 10), 0.15 + r() * r() * 6, -r() * (-TRACK.zEnd - 6));
      dummy.scale.set(1, 1, len);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(i, dummy.matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((state) => {
    const w = window01(scroll.progress, 0.12, 0.16, 0.015);
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uOpacity.value = w;
    if (mesh.current) mesh.current.visible = w > 0.001;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, COUNT]} frustumCulled={false} visible={false} />;
}
