"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { keyed, range, scroll, smooth, window01 } from "@/lib/scroll";
import { BUILDINGS, CZ, SKYLINE, STREAMS, rng, type Building } from "@/lib/layouts";
import { SkyDome, type SkyPalette } from "../SkyDome";
import { createFacadeMaterial, createStreetMaterial, streetUniforms } from "./scale/facade";

type Tower = Building & { jitter: number };

function towers(list: Building[], seed: number): Tower[] {
  const r = rng(seed);
  return list.map((b) => ({ ...b, jitter: r() }));
}

const CORE_TOWERS = towers(BUILDINGS, 11);
const FAR_TOWERS = towers(SKYLINE, 12);
const CORE_GLASS = CORE_TOWERS.filter((b) => b.glass);
const CORE_STONE = CORE_TOWERS.filter((b) => !b.glass);
const FAR_GLASS = FAR_TOWERS.filter((b) => b.glass);
const FAR_STONE = FAR_TOWERS.filter((b) => !b.glass);

// Blue-grey, smoked and bronze glass; limestone, sandstone, brick, concrete and granite.
const GLASS_TONES = ["#5d7884", "#4b5f69", "#6f6a5f", "#55707a", "#7a8a8f"];
const STONE_TONES = ["#b8a58c", "#c4a07a", "#8e5b45", "#8f8b86", "#a88f78", "#5a524c", "#d1c0a4"];

function instanceColors(list: Tower[], tones: string[]) {
  const c = new THREE.Color();
  const out = new Float32Array(list.length * 3);
  list.forEach((b, i) => {
    c.set(tones[Math.floor(b.jitter * tones.length * 7.31) % tones.length]).toArray(out, i * 3);
  });
  return out;
}

// How far into golden hour the street is: dark while the blueprint draws, dark again as the city melts.
const DAY: [number, number][] = [[0.49, 0], [0.535, 1], [0.655, 1], [0.7, 0]];
// Teal sky over a golden horizon, the sun low at the end of the avenue.
const PALETTE: SkyPalette = { zenith: "#2c6079", high: "#4f8ba0", mid: "#d9a77a", low: "#ffc274" };
const SUN_DISC = new THREE.Vector3(0, 0.06, -1).normalize();
// The light comes from a little left of the disc so the right-hand facades catch it, as in the street photo.
const SUN_LIGHT = new THREE.Vector3(-0.55, 0.42, -0.72).normalize();
const skySun = (_p: number, out: THREE.Vector3) => out.copy(SUN_DISC);
const skyNight = (p: number) => 1 - keyed(p, DAY);

function createStreamMaterial(offset: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uOffset: { value: offset },
      uColor: { value: new THREE.Color("#ffbf4d") },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity, uOffset;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float packet = pow(fract(vUv.x * 4.0 - uTime * 0.7 + uOffset), 8.0);
        float trail = pow(fract(vUv.x * 4.0 - uTime * 0.7 + uOffset), 2.0) * 0.35;
        float edgeFade = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        vec3 col = uColor * (0.5 + trail * 2.0 + packet * 5.0);
        gl_FragColor = vec4(col, uOpacity * edgeFade * (0.45 + packet + trail));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Phase 4: blueprint footprints extrude into a city at golden hour: glass and stone towers along an
 * avenue running to a low sun, with labelled data streams arcing between them.
 */
export function Scale({ shadowMapSize }: { shadowMapSize: number }) {
  const group = useRef<THREE.Group>(null);
  const coreGlass = useRef<THREE.InstancedMesh>(null);
  const coreStone = useRef<THREE.InstancedMesh>(null);
  const farGlass = useRef<THREE.InstancedMesh>(null);
  const farStone = useRef<THREE.InstancedMesh>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const streamGroup = useRef<THREE.Group>(null);
  const labels = useRef<({ fillOpacity: number } | null)[]>([]);
  const lastP = useRef(-1);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const glassMaterial = useMemo(() => createFacadeMaterial("glass"), []);
  const stoneMaterial = useMemo(() => createFacadeMaterial("stone"), []);
  const streetMaterial = useMemo(() => createStreetMaterial(CZ), []);
  const ground = useRef<THREE.Mesh>(null);
  const colors = useMemo(
    () => ({
      coreGlass: instanceColors(CORE_GLASS, GLASS_TONES),
      coreStone: instanceColors(CORE_STONE, STONE_TONES),
      farGlass: instanceColors(FAR_GLASS, GLASS_TONES),
      farStone: instanceColors(FAR_STONE, STONE_TONES),
    }),
    [],
  );
  const sunTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0, CZ);
    return o;
  }, []);

  const streams = useMemo(
    () =>
      STREAMS.map((s, i) => {
        const curve = new THREE.CatmullRomCurve3(s.points.map((v) => new THREE.Vector3(...v)));
        // Labels sit near alternating ends of their streams so they fan out to both sides of the canyon.
        const mid = curve.getPoint(i % 2 === 0 ? 0.2 : 0.8);
        return {
          label: s.label,
          geometry: new THREE.TubeGeometry(curve, 80, 0.09, 8, false),
          material: createStreamMaterial(i * 0.37),
          labelPos: [mid.x, mid.y + 1.2 + (i % 3) * 0.6, mid.z] as [number, number, number],
        };
      }),
    [],
  );

  useFrame((state) => {
    const p = scroll.progress;
    const g = group.current;
    if (!g) return;
    g.visible = p > 0.46 && p < 0.76;
    if (!g.visible) return;

    const day = keyed(p, DAY);
    streetUniforms.uDay.value = day;
    if (sun.current) {
      sun.current.intensity = day * 4.6;
      sun.current.position.copy(sunTarget.position).addScaledVector(SUN_LIGHT, 220);
    }
    if (hemi.current) hemi.current.intensity = day * 0.9;
    const groundIn = smooth(range(p, 0.49, 0.53)) * (1 - smooth(range(p, 0.67, 0.71)));
    streetMaterial.opacity = groundIn;
    if (ground.current) ground.current.visible = groundIn > 0.001;

    const w = window01(p, 0.535, 0.665, 0.03);
    if (streamGroup.current) streamGroup.current.visible = w > 0.001;
    streams.forEach((s) => {
      s.material.uniforms.uTime.value = state.clock.elapsedTime;
      s.material.uniforms.uOpacity.value = w;
    });
    labels.current.forEach((l) => {
      if (l) l.fillOpacity = w;
    });

    if (Math.abs(p - lastP.current) < 1e-5) return;
    lastP.current = p;

    // Extrude outward from the centre, then melt down in a staggered dissolve.
    const place = (mesh: THREE.InstancedMesh | null, list: Tower[]) => {
      if (!mesh) return;
      list.forEach((b, i) => {
        const e = smooth(range(p, 0.47 + b.delay * 0.05, 0.515 + b.delay * 0.05));
        const j = b.jitter;
        const d = smooth(range(p, 0.67 + j * 0.04, 0.712 + j * 0.04));
        const shrink = 1 - d * 0.5;
        dummy.position.set(b.x, 0, b.z);
        dummy.scale.set(b.w * shrink, Math.max(0.0001, b.h * e * (1 - d)), b.d * shrink);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(coreGlass.current, CORE_GLASS);
    place(coreStone.current, CORE_STONE);
    place(farGlass.current, FAR_GLASS);
    place(farStone.current, FAR_STONE);
  });

  return (
    <group ref={group} visible={false}>
      <SkyDome palette={PALETTE} sun={skySun} night={skyNight} cover={0.5} />

      <primitive object={sunTarget} />
      <directionalLight
        ref={sun}
        target={sunTarget}
        color="#ffbb78"
        intensity={0}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-near={1}
        shadow-camera-far={500}
      />
      <hemisphereLight ref={hemi} args={["#8fb6cc", "#4a3a2e", 0]} />

      <mesh ref={ground} rotation-x={-Math.PI / 2} position={[100, 0.02, -260]} material={streetMaterial} receiveShadow visible={false}>
        <planeGeometry args={[900, 700]} />
      </mesh>

      {/* The core blocks cast the shadows; the distant skyline only receives them. */}
      <instancedMesh ref={coreGlass} args={[box, glassMaterial, CORE_GLASS.length]} frustumCulled={false} castShadow receiveShadow>
        <instancedBufferAttribute attach="instanceColor" args={[colors.coreGlass, 3]} />
      </instancedMesh>
      <instancedMesh ref={coreStone} args={[box, stoneMaterial, CORE_STONE.length]} frustumCulled={false} castShadow receiveShadow>
        <instancedBufferAttribute attach="instanceColor" args={[colors.coreStone, 3]} />
      </instancedMesh>
      <instancedMesh ref={farGlass} args={[box, glassMaterial, FAR_GLASS.length]} frustumCulled={false} receiveShadow>
        <instancedBufferAttribute attach="instanceColor" args={[colors.farGlass, 3]} />
      </instancedMesh>
      <instancedMesh ref={farStone} args={[box, stoneMaterial, FAR_STONE.length]} frustumCulled={false} receiveShadow>
        <instancedBufferAttribute attach="instanceColor" args={[colors.farStone, 3]} />
      </instancedMesh>
      <group ref={streamGroup}>
        {streams.map((s, i) => (
          <group key={s.label}>
            <mesh geometry={s.geometry} material={s.material} frustumCulled={false} />
            <Billboard position={s.labelPos}>
              <Text
                ref={(el: unknown) => {
                  labels.current[i] = el as { fillOpacity: number } | null;
                }}
                font="/fonts/Geist-Regular.ttf"
                fontSize={1.15}
                letterSpacing={0.04}
                color="#ffe2a8"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.05}
                outlineColor="#2a1606"
              >
                {s.label}
              </Text>
            </Billboard>
          </group>
        ))}
      </group>
    </group>
  );
}
