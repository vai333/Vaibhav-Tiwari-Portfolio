"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { range, scroll, smooth } from "@/lib/scroll";
import { FUNNEL_H, rng } from "@/lib/layouts";
import { getGlowTexture } from "../../materials";

const STRANDS = 72;
const SEGMENTS = 360;

// Shared GLSL: where a strand sits at height parameter u, and its colour there.
const FUNNEL_GLSL = /* glsl */ `
  const float H = ${FUNNEL_H.toFixed(1)};
  // S-curved spine; the funnel is pencil-thin at the ground and flares into a sweeping swirl.
  vec3 funnelPoint(float u, float phase, float jit, float time, out float can, out float th) {
    can = smoothstep(0.72, 1.0, u);
    vec3 spine = vec3(4.2 * sin(u * 5.0 - 0.3) * min(1.0, u * 2.5), u * H, 0.0);
    float R = (0.5 + 4.2 * pow(u, 1.3) + 17.0 * can * can) * (0.8 + jit * 0.4);
    // Fixed twist (~2.5 turns up the body, more in the swirl) with rigid spin, so the shape never
    // winds or unwinds over time; a bounded wobble keeps the base lively.
    th = phase + u * 15.0 + can * 5.0 + time * 0.9 + sin(time * 0.8) * (1.0 - u) * 0.6;
    vec3 p = spine + vec3(cos(th) * R, 0.0, sin(th) * R * 0.85);
    float sheetY = H * 0.9 + sin(th) * R * 0.1 + cos(th) * R * 0.05;
    p.y = mix(p.y, sheetY, can * 0.85);
    // Sweep the swirl off to one side so it trails like the reference, not a symmetric mushroom.
    p.x += can * can * 12.0 + can * max(cos(th), 0.0) * R * 0.45;
    return p;
  }
  vec3 funnelColor(float u) {
    vec3 hot = vec3(3.6, 2.4, 1.1);
    vec3 gold = vec3(2.6, 1.35, 0.42);
    vec3 amber = vec3(2.3, 1.1, 0.34);
    return mix(mix(hot, gold, smoothstep(0.0, 0.12, u)), amber, smoothstep(0.55, 1.0, u));
  }
`;

/** Strands are grouped into four bundles, so the funnel shows distinct layered ribbons. */
const strandPhase = (s: number) => ((s % 4) / 4) * Math.PI * 2 + ((s >> 2) / (STRANDS / 4) - 0.5) * 0.9;

/** Ribbon strips: two vertices per segment, swept along each strand's helix in the vertex shader. */
function buildRibbons() {
  const r = rng(404);
  const verts = STRANDS * (SEGMENTS + 1) * 2;
  const u = new Float32Array(verts);
  const side = new Float32Array(verts);
  const phase = new Float32Array(verts);
  const jit = new Float32Array(verts);
  const seed = new Float32Array(verts);
  const index: number[] = [];
  let v = 0;
  for (let s = 0; s < STRANDS; s++) {
    const ph = strandPhase(s);
    const j = r();
    const sd = r();
    const start = v;
    for (let k = 0; k <= SEGMENTS; k++) {
      for (const sgn of [-1, 1]) {
        u[v] = k / SEGMENTS;
        side[v] = sgn;
        phase[v] = ph;
        jit[v] = j;
        seed[v] = sd;
        v++;
      }
      if (k < SEGMENTS) {
        const a = start + k * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
  geo.setAttribute("aU", new THREE.BufferAttribute(u, 1));
  geo.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("aJit", new THREE.BufferAttribute(jit, 1));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geo.setIndex(index);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, FUNNEL_H / 2, 0), 60);
  return geo;
}

function createRibbonMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aU, aSide, aPhase, aJit, aSeed;
      uniform float uTime;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSide;
      ${FUNNEL_GLSL}
      void main() {
        float can, th;
        vec3 p = funnelPoint(aU, aPhase, aJit, uTime, can, th);
        // Ribbon width: stacked bands up the body, opening radially in the swirl.
        float w = (0.07 + 0.14 * aU) * (0.6 + aSeed * 0.8);
        vec3 across = mix(vec3(0.0, 1.0, 0.0), vec3(cos(th), 0.0, sin(th)), can);
        p += across * aSide * w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);

        // Light pulses travelling up each ribbon, offset per strand.
        float flow = pow(0.5 + 0.5 * sin(aU * 26.0 - uTime * 2.6 + aSeed * 12.0), 3.0);
        float strand = 0.35 + 0.65 * aSeed;
        float ends = smoothstep(0.0, 0.02, aU) * (1.0 - smoothstep(0.9, 1.0, aU));
        vColor = funnelColor(aU);
        // The narrow body packs every strand close together; thin it out so the layers separate.
        float body = mix(0.85, 1.0, smoothstep(0.08, 0.6, aU));
        vAlpha = (0.08 + 0.92 * flow) * strand * ends * body;
        vSide = aSide;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSide;
      void main() {
        float edge = 1.0 - abs(vSide);
        float a = edge * edge * vAlpha * uOpacity * 0.11;
        if (a < 0.002) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/** Sparks scattered along the same strands for texture. */
function buildSparks(count: number) {
  const r = rng(405);
  const u = new Float32Array(count), phase = new Float32Array(count), jit = new Float32Array(count), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    phase[i] = strandPhase(Math.floor(r() * STRANDS)) + (r() - 0.5) * 0.3;
    u[i] = Math.pow(r(), 0.8);
    jit[i] = r();
    seed[i] = r();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute("aU", new THREE.BufferAttribute(u, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("aJit", new THREE.BufferAttribute(jit, 1));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, FUNNEL_H / 2, 0), 60);
  return geo;
}

function createSparkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aU, aPhase, aJit, aSeed;
      uniform float uTime, uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;
      ${FUNNEL_GLSL}
      void main() {
        float u = fract(aU + uTime * (0.02 + aSeed * 0.015));
        float can, th;
        vec3 p = funnelPoint(u, aPhase, aJit * 1.3, uTime, can, th);
        p += vec3(sin(aSeed * 50.0), cos(aSeed * 31.0), sin(aSeed * 17.0)) * (0.2 + u * 1.2);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(uPixelRatio * (0.6 + aSeed) * 60.0 / -mv.z, 10.0);
        vColor = funnelColor(u);
        vAlpha = 0.5 * smoothstep(0.0, 0.03, u) * (1.0 - smoothstep(0.9, 1.0, u)) * (0.5 + 0.5 * sin(uTime * 4.0 + aSeed * 40.0));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a = a * a * vAlpha * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * The source of light: a twisting funnel of glowing ribbons on an S-curved spine, pencil-thin at
 * the ground and flaring at the top into a sweeping swirl, with sparks riding the strands.
 */
export function Funnel({ count }: { count: number }) {
  const group = useRef<THREE.Group>(null);
  const flare = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.PointLight>(null);
  const dpr = useThree((s) => s.viewport.dpr);

  const ribbons = useMemo(buildRibbons, []);
  const ribbonMaterial = useMemo(createRibbonMaterial, []);
  const sparks = useMemo(() => buildSparks(count), [count]);
  const sparkMaterial = useMemo(createSparkMaterial, []);

  useFrame((state) => {
    const p = scroll.progress;
    const t = state.clock.elapsedTime;
    const fade = 1 - smooth(range(p, 0.12, 0.17));
    if (group.current) group.current.visible = fade > 0.001;
    ribbonMaterial.uniforms.uTime.value = t;
    ribbonMaterial.uniforms.uOpacity.value = fade;
    sparkMaterial.uniforms.uTime.value = t;
    sparkMaterial.uniforms.uOpacity.value = fade;
    sparkMaterial.uniforms.uPixelRatio.value = dpr;
    if (glow.current) glow.current.intensity = fade * 650;
    if (flare.current) {
      flare.current.material.opacity = fade * (0.75 + Math.sin(t * 3) * 0.1);
      flare.current.scale.setScalar(7 + Math.sin(t * 3) * 0.5);
    }
    if (ring.current) {
      const k = (t * 0.5) % 1;
      ring.current.scale.setScalar(0.8 + k * 3);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = fade * (1 - k) * 0.8;
    }
  });

  return (
    <group ref={group}>
      <mesh geometry={ribbons} material={ribbonMaterial} frustumCulled={false} />
      <points geometry={sparks} material={sparkMaterial} frustumCulled={false} />
      {/* Light from inside the funnel rim-lights the cloud tops. */}
      <pointLight ref={glow} position={[2.5, 9, 0]} color="#ffb257" intensity={650} decay={2} />
      <sprite ref={flare} position={[0, 0.6, 0]} scale={7}>
        <spriteMaterial map={getGlowTexture()} color="#ffbe62" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.93, 1, 64]} />
        <meshBasicMaterial color={[3, 1.9, 0.7]} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}
