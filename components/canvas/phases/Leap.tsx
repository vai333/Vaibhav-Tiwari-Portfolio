"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { easeOutCubic, range, scroll, smooth } from "@/lib/scroll";
import { DASHBOARD_POS, ROOFTOP_CAMERA } from "@/lib/layouts";
import { setHtmlOpacity } from "../materials";
import { SunriseSky, sunDirection } from "./leap/SunriseSky";
import { City } from "./leap/City";

const CAMERA_REST = new THREE.Vector3(...ROOFTOP_CAMERA);
const TARGET = 200000;

/**
 * Phase 6: night gives way to golden hour. From a rooftop edge the camera looks out over a hazy city
 * toward a low sun, with the HONEST SWEET dashboard floating just off the ledge.
 */
export function Leap() {
  const group = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const dash = useRef<THREE.Group>(null);
  const dashHtml = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const weeks = useRef<(HTMLDivElement | null)[]>([]);
  const lastCount = useRef(-1);

  const sunDir = useMemo(() => new THREE.Vector3(), []);
  const sunTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0, -450);
    return o;
  }, []);

  useFrame((state) => {
    const p = scroll.progress;
    const g = group.current;
    if (!g) return;
    g.visible = p > 0.8;
    if (!g.visible) {
      setHtmlOpacity(dashHtml.current, 0);
      return;
    }

    // Low golden sun from behind the skyline: rims the roofs, leaves facades in warm shadow.
    const day = smooth(range(p, 0.86, 0.95));
    sunDirection(p, sunDir);
    if (sun.current) {
      sun.current.position.copy(sunTarget.position).addScaledVector(sunDir, 600);
      sun.current.intensity = day * 3.2;
    }
    if (hemi.current) hemi.current.intensity = day * 0.6;

    // Dashboard: keep it in frame on narrow screens and turned toward the resting camera.
    if (dash.current) {
      const aspect = state.size.width / state.size.height;
      const narrow = aspect < 1;
      // On phones the story card covers the lower half, so lift the dashboard above the horizon.
      if (narrow) dash.current.position.set(ROOFTOP_CAMERA[0] + 0.6, ROOFTOP_CAMERA[1] + 1.5, ROOFTOP_CAMERA[2] - 7.5);
      else dash.current.position.set(...DASHBOARD_POS);
      dash.current.lookAt(CAMERA_REST);
      const inn = smooth(range(p, 0.885, 0.925));
      dash.current.scale.setScalar(Math.max(0.0001, 0.72 + inn * 0.13));
      dash.current.visible = inn > 0.001;
      setHtmlOpacity(dashHtml.current, inn);
    }

    const c = easeOutCubic(range(p, 0.9, 0.965));
    const value = Math.round((c * TARGET) / 1000) * 1000;
    if (value !== lastCount.current && counter.current) {
      lastCount.current = value;
      counter.current.textContent = c >= 0.999 ? "₹2+ Lakh" : `₹${value.toLocaleString("en-IN")}`;
      weeks.current.forEach((w, k) => {
        if (w) w.style.transform = `scaleX(${Math.min(1, Math.max(0, c * 4 - k))})`;
      });
    }
  });

  return (
    <group ref={group} visible={false}>
      <SunriseSky />
      <City />

      <primitive object={sunTarget} />
      <directionalLight ref={sun} target={sunTarget} color="#ffc98f" intensity={0} />
      <hemisphereLight ref={hemi} args={["#ffc7a0", "#3d2c2a", 0]} />

      {/* HONEST SWEET dashboard: smoked glass with gold type, floating just off the rooftop ledge. */}
      <group ref={dash} position={DASHBOARD_POS} visible={false}>
        <Float speed={1.4} rotationIntensity={0.08} floatIntensity={0.35}>
          <RoundedBox args={[3.5, 2.15, 0.08]} radius={0.06} smoothness={4}>
            <meshPhysicalMaterial color="#1d1510" roughness={0.2} metalness={0.2} clearcoat={1} transparent opacity={0.72} envMapIntensity={1.2} />
          </RoundedBox>
          <Html transform distanceFactor={3.75} position={[0, 0, 0.06]} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            <div ref={dashHtml} style={{ opacity: 0, visibility: "hidden" }} className="w-[340px] select-none p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="font-display text-sm font-bold uppercase tracking-[0.2em] text-amber-300">HONEST SWEET</div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> live
                </div>
              </div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Revenue</div>
              <span ref={counter} className="mt-1 block font-display text-4xl font-bold tabular-nums tracking-tight text-amber-200">
                ₹0
              </span>
              <div className="mt-1 text-sm font-medium text-white/85">in the first 4 weeks</div>
              <div className="mt-5 grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((w, k) => (
                  <div key={w}>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                      <div
                        ref={(el) => {
                          weeks.current[k] = el;
                        }}
                        className="h-full origin-left rounded-full bg-gradient-to-r from-amber-300 to-orange-500"
                        style={{ transform: "scaleX(0)" }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-white/70">Week {w}</div>
                  </div>
                ))}
              </div>
            </div>
          </Html>
        </Float>
      </group>
    </group>
  );
}
