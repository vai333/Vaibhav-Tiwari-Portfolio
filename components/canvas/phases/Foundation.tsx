"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { range, scroll, smooth, window01 } from "@/lib/scroll";
import { BLUEPRINT, PILLAR } from "@/lib/layouts";
import { createRevealLineMaterial, lineGeometry } from "../materials";
import { addSkyReflection } from "./scale/facade";

const BANDS = 7;

/** Height of the central pillar for a given progress; it keeps growing into the city's hub tower in phase 4. */
export function pillarHeight(p: number) {
  const grow = smooth(range(p, 0.4, 0.46)) * PILLAR.height + smooth(range(p, 0.5, 0.58)) * (PILLAR.towerHeight - PILLAR.height);
  return grow * (1 - smooth(range(p, 0.67, 0.72)));
}

function createBeamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color("#ffd49a") } },
    vertexShader: /* glsl */ `
      varying float vH;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vH = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying float vH;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        // Guard every term: a single NaN pixel here gets smeared over the whole frame by bloom.
        float rim = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.8);
        float a = rim * pow(clamp(vH, 0.0, 1.0), 1.4) * uOpacity * 0.32;
        if (!(a > 0.001)) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/** Phase 3: the blueprint draws itself on the grid, a gleaming pillar constructs under a volumetric beam. */
export function Foundation() {
  const group = useRef<THREE.Group>(null);
  const shaft = useRef<THREE.Mesh>(null);
  const cone = useRef<THREE.Mesh>(null);
  const cap = useRef<THREE.Mesh>(null);
  const bands = useRef<(THREE.Mesh | null)[]>([]);

  const blueprint = useMemo(() => lineGeometry(BLUEPRINT.positions, BLUEPRINT.order), []);
  const blueprintMaterial = useMemo(() => createRevealLineMaterial("#ffb84a", 1.5), []);
  const beam = useMemo(createBeamMaterial, []);
  // Polished gold; in the street's daylight it mirrors the sky like the glass towers around it.
  const shaftMaterial = useMemo(
    () =>
      addSkyReflection(
        new THREE.MeshPhysicalMaterial({ color: "#e8c27a", metalness: 1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.8 }),
        "#ffcf86",
        0.9,
      ),
    [],
  );
  const shaftGeometry = useMemo(() => new THREE.CylinderGeometry(PILLAR.radius * 0.8, PILLAR.radius, 1, 48, 1).translate(0, 0.5, 0), []);

  useFrame((state) => {
    const p = scroll.progress;
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    g.visible = p > 0.33 && p < 0.75;
    if (!g.visible) return;

    blueprintMaterial.uniforms.uReveal.value = range(p, 0.35, 0.44);
    blueprintMaterial.uniforms.uOpacity.value = 1 - smooth(range(p, 0.5, 0.555));

    const h = pillarHeight(p);
    if (shaft.current) {
      // A near-zero scale makes the clearcoat normals degenerate (NaN → bloom blacks out the frame).
      shaft.current.visible = h > 0.02;
      shaft.current.scale.set(1, Math.max(0.02, h), 1);
    }
    if (cap.current) {
      cap.current.position.y = h + 0.05;
      cap.current.visible = h > 0.2;
    }
    bands.current.forEach((band, k) => {
      if (!band) return;
      const frac = (k + 1) / (BANDS + 1);
      band.position.y = frac * h;
      const r = PILLAR.radius * (1 - frac * 0.2) + 0.06;
      band.scale.set(r, r, 1 + Math.sin(t * 2 + k) * 0.3);
      band.visible = h > 0.5;
    });

    beam.uniforms.uOpacity.value = window01(p, 0.39, 0.52, 0.04);
    if (cone.current) cone.current.visible = beam.uniforms.uOpacity.value > 0.001;
  });

  return (
    <group ref={group} visible={false}>
      <lineSegments geometry={blueprint} material={blueprintMaterial} frustumCulled={false} />
      <group position={[PILLAR.x, 0, PILLAR.z]}>
        <mesh ref={shaft} geometry={shaftGeometry} material={shaftMaterial} />
        <mesh ref={cap} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[PILLAR.radius * 0.8, 48]} />
          <meshBasicMaterial color={[5, 3.4, 1.4]} toneMapped={false} />
        </mesh>
        {Array.from({ length: BANDS }, (_, k) => (
          <mesh
            key={k}
            rotation-x={Math.PI / 2}
            ref={(el) => {
              bands.current[k] = el;
            }}
          >
            <torusGeometry args={[1, 0.035, 8, 64]} />
            <meshBasicMaterial color={[3.6, 2.2, 0.7]} toneMapped={false} />
          </mesh>
        ))}
        <mesh ref={cone} position={[0, 25, 0]} material={beam}>
          <coneGeometry args={[8, 46, 48, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}
