"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { easeOutCubic, range, scroll } from "@/lib/scroll";
import { CITY, ROOFTOP } from "@/lib/layouts";

/**
 * Adds a world-space window grid to building facades: dark glass panes, a few lit warm, fading to
 * plain walls with distance so far blocks don't shimmer.
 */
function addWindows(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
          wn = mat3(instanceMatrix) * wn;
        #endif
        vWPos = (modelMatrix * wp4).xyz;
        vWNormal = normalize(mat3(modelMatrix) * wn);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNormal;
        float winHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float winMask = 0.0;
        float winGlow = 0.0;
        vec3 wn = normalize(vWNormal);
        float winFar = smoothstep(140.0, 420.0, length(vWPos - cameraPosition));
        if (abs(wn.y) < 0.5) {
          vec2 g = vec2((abs(wn.x) > 0.5 ? vWPos.z : vWPos.x) / 2.6, vWPos.y / 3.3);
          vec2 f = fract(g);
          float pane = step(0.2, f.x) * step(f.x, 0.8) * step(0.28, f.y) * step(f.y, 0.86);
          winMask = pane * (1.0 - winFar);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.28 + vec3(0.03, 0.025, 0.03), winMask);
          winGlow = winMask * step(0.94, winHash(floor(g) + floor(vWPos.xz * 0.05)));
        } else {
          diffuseColor.rgb *= 1.12; // sunlit roofs read a touch brighter
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.22, winMask);",
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.6, 0.28) * winGlow * 1.3;",
      );
  };
  material.customProgramCacheKey = () => "city-windows";
  return material;
}

/** Setback blocks reuse their building's tone, slightly lighter. */
function setbackColors(indices: number[], colors: Float32Array) {
  const out = new Float32Array(indices.length * 3);
  indices.forEach((bi, k) => {
    for (let c = 0; c < 3; c++) out[k * 3 + c] = Math.min(1, colors[bi * 3 + c] * 1.08);
  });
  return out;
}

/** The golden-hour city: thousands of blocks rising out of the dusk, plus the rooftop the camera stands on. */
export function City() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const roof = useRef<THREE.Group>(null);
  const lastP = useRef(-1);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const material = useMemo(() => addWindows(new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 })), []);
  const roofMaterial = useMemo(() => addWindows(new THREE.MeshStandardMaterial({ color: "#8b7468", roughness: 0.9 })), []);

  const setbacks = useMemo(() => CITY.map((b, i) => ({ i, ok: ((b.tone * 13.7) % 1) < 0.4 })).filter((s) => s.ok).map((s) => s.i), []);
  const tops = useRef<THREE.InstancedMesh>(null);

  const colors = useMemo(() => {
    const c = new THREE.Color();
    const arr = new Float32Array(CITY.length * 3);
    CITY.forEach((b, i) => {
      // Warm concrete, sand and terracotta tones.
      c.setHSL(0.04 + b.tone * 0.07, 0.14 + b.tone * 0.16, 0.48 + ((b.tone * 7.31) % 1) * 0.22);
      c.toArray(arr, i * 3);
    });
    return arr;
  }, []);

  const topColors = useMemo(() => setbackColors(setbacks, colors), [setbacks, colors]);

  useFrame(() => {
    const p = scroll.progress;
    if (Math.abs(p - lastP.current) < 1e-5 || !mesh.current) return;
    lastP.current = p;
    // The city rises out of the dark as dawn breaks, nearest blocks first.
    CITY.forEach((b, i) => {
      const delay = Math.min(1, (-b.z - 180) / 820) * 0.05;
      const rise = easeOutCubic(range(p, 0.835 + delay, 0.885 + delay));
      dummy.position.set(b.x, 0, b.z);
      dummy.scale.set(b.w, Math.max(0.001, b.h * rise), b.d);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (tops.current) {
      setbacks.forEach((bi, k) => {
        const b = CITY[bi];
        const delay = Math.min(1, (-b.z - 180) / 820) * 0.05;
        const rise = easeOutCubic(range(p, 0.835 + delay, 0.885 + delay));
        dummy.position.set(b.x + b.w * 0.08, b.h * rise, b.z - b.d * 0.06);
        dummy.scale.set(b.w * 0.58, Math.max(0.001, b.h * 0.22 * rise), b.d * 0.58);
        dummy.updateMatrix();
        tops.current!.setMatrixAt(k, dummy.matrix);
      });
      tops.current.instanceMatrix.needsUpdate = true;
    }
    if (roof.current) roof.current.scale.y = Math.max(0.001, easeOutCubic(range(p, 0.83, 0.875)));
  });

  return (
    <group>
      <instancedMesh ref={mesh} args={[box, material, CITY.length]} frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
      </instancedMesh>
      <instancedMesh ref={tops} args={[box, material, setbacks.length]} frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[topColors, 3]} />
      </instancedMesh>
      {/* Ground far below, lost in the haze. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.1, -600]}>
        <planeGeometry args={[3000, 1600]} />
        <meshStandardMaterial color="#2b211e" roughness={1} />
      </mesh>
      {/* The rooftop under the camera, with a parapet whose edge catches the sun. */}
      <group ref={roof} position={[ROOFTOP.x, 0, ROOFTOP.z]}>
        <mesh position={[0, ROOFTOP.h / 2, 0]} material={roofMaterial}>
          <boxGeometry args={[ROOFTOP.w, ROOFTOP.h, ROOFTOP.d]} />
        </mesh>
        <mesh position={[0, ROOFTOP.h + 0.5, ROOFTOP.d / 2 - 0.25]}>
          <boxGeometry args={[ROOFTOP.w, 1, 0.5]} />
          <meshStandardMaterial color="#9a7f70" roughness={0.8} />
        </mesh>
        <mesh position={[ROOFTOP.w / 2 - 0.25, ROOFTOP.h + 0.5, 0]}>
          <boxGeometry args={[0.5, 1, ROOFTOP.d]} />
          <meshStandardMaterial color="#9a7f70" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}
