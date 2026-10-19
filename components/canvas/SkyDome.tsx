"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { scroll } from "@/lib/scroll";

export type SkyPalette = { zenith: string; high: string; mid: string; low: string };

type Props = {
  palette: SkyPalette;
  /** Sun direction for a scroll progress (written into `out`). */
  sun: (p: number, out: THREE.Vector3) => THREE.Vector3;
  /** How much of the night remains (1 = sky fully hidden behind the scene background). */
  night: (p: number) => number;
  /** Cloud cover threshold on the fbm noise: higher means fewer, smaller clouds. */
  cover?: number;
};

/**
 * Golden-hour sky on a camera-centred sphere: a gradient from zenith to horizon, layered clouds lit
 * warm from below, and a soft sun. The horizon colour is the scene fog colour, so distant geometry
 * dissolves seamlessly into the haze; at night it fades to the scene background.
 */
export function SkyDome({ palette, sun, night, cover = 0.44 }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const scene = useThree((s) => s.scene);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSun: { value: new THREE.Vector3(0, 0, -1) },
          uNight: { value: 1 },
          uCover: { value: cover },
          uNightColor: { value: new THREE.Color("#0c0907") },
          uHaze: { value: new THREE.Color("#f0b783") },
          uZenith: { value: new THREE.Color(palette.zenith) },
          uHigh: { value: new THREE.Color(palette.high) },
          uMid: { value: new THREE.Color(palette.mid) },
          uLow: { value: new THREE.Color(palette.low) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime, uNight, uCover;
          uniform vec3 uSun, uNightColor, uHaze, uZenith, uHigh, uMid, uLow;
          varying vec3 vDir;

          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
          }
          float fbm(vec2 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 6; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
            return v;
          }

          void main() {
            vec3 dir = normalize(vDir);
            float h = dir.y;
            float sd = max(dot(dir, normalize(uSun)), 0.0);

            // Sky gradient, warmer toward the sun.
            vec3 sky = mix(uLow, uMid, smoothstep(0.02, 0.12, h));
            sky = mix(sky, uHigh, smoothstep(0.1, 0.32, h));
            sky = mix(sky, uZenith, smoothstep(0.3, 0.75, h));
            sky = mix(sky, uHaze * 1.08, (1.0 - smoothstep(0.0, 0.06, h)) * 0.85);
            sky += vec3(1.0, 0.62, 0.3) * (pow(sd, 6.0) * 0.35 + pow(sd, 40.0) * 0.5);

            // The sun: a pale-gold disc with a crisp edge; the halo stays dimmer than the disc so tone
            // mapping keeps them apart.
            float disc = smoothstep(0.99895, 0.99935, sd);
            sky = mix(sky, vec3(3.2, 2.7, 1.55), disc);
            sky += vec3(1.1, 0.55, 0.2) * pow(sd, 2500.0) * (1.0 - disc) + vec3(0.7, 0.36, 0.14) * pow(sd, 70.0);

            // Layered clouds on a horizontal plane: long bands near the horizon, softer puffs above.
            vec2 uv = dir.xz / (h + 0.08);
            uv *= vec2(0.28, 1.0) * 1.4;
            uv.x += uTime * 0.004;
            float n = fbm(uv) * 0.72 + fbm(uv * 2.4 + 7.0) * 0.38;
            // A clear band just above the horizon lets the sun sit beneath the clouds, as at real golden hour.
            float cover = smoothstep(uCover, uCover + 0.3, n) * smoothstep(0.085, 0.17, h) * (1.0 - smoothstep(0.5, 0.95, h) * 0.6);
            cover *= 1.0 - pow(sd, 600.0) * 0.9;
            float lit = clamp(pow(sd, 3.0) * 1.6 + (1.0 - smoothstep(0.0, 0.35, h)) * 0.55, 0.0, 1.0);
            vec3 cloud = mix(vec3(0.46, 0.32, 0.42), vec3(1.7, 0.86, 0.5), lit);
            // Thin cloud edges catch the most light.
            cloud += vec3(1.3, 0.75, 0.4) * cover * (1.0 - cover) * 1.8 * (0.3 + lit);
            sky = mix(sky, cloud, cover * 0.92);

            // Below the horizon is pure haze, matching the fog.
            sky = mix(sky, uHaze, 1.0 - smoothstep(-0.02, 0.005, h));

            gl_FragColor = vec4(mix(sky, uNightColor, uNight), 1.0);
          }
        `,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [palette, cover],
  );

  useFrame((state) => {
    const p = scroll.progress;
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    sun(p, u.uSun.value);
    u.uNight.value = night(p);
    if (scene.background instanceof THREE.Color) u.uNightColor.value.copy(scene.background);
    if (scene.fog) u.uHaze.value.copy(scene.fog.color);
    mesh.current?.position.copy(state.camera.position);
  });

  return (
    <mesh ref={mesh} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1500, 48, 24]} />
    </mesh>
  );
}
