"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { range, scroll, smooth } from "@/lib/scroll";
import { rng } from "@/lib/layouts";

type Puff = { x: number; y: number; z: number; s: number };

type CloudsProps = {
  /** Centre of the cloud ring on the ground plane (x, z). */
  center?: [number, number];
  innerRadius?: number;
  outerRadius?: number;
  clusters?: number;
  seed?: number;
  /** Return true for cluster centres that must stay empty (e.g. a camera sightline). */
  keepClear?: (x: number, z: number) => boolean;
  /** Scroll range over which the clouds billow up out of the ground; omit to start risen. */
  rise?: [number, number];
  /** Scroll range over which they sink back into the ground. */
  sink: [number, number];
};

function buildPuffs({ center = [0, 0], innerRadius = 17, outerRadius = 65, clusters = 46, seed = 808, keepClear }: CloudsProps): Puff[] {
  const r = rng(seed);
  const puffs: Puff[] = [];
  for (let c = 0; c < clusters; c++) {
    const ang = r() * Math.PI * 2;
    const rad = innerRadius + r() * (outerRadius - innerRadius);
    const cx = center[0] + Math.cos(ang) * rad;
    const cz = center[1] + Math.sin(ang) * rad;
    if (keepClear?.(cx, cz)) continue;
    const n = 5 + Math.floor(r() * 8);
    const scale = 1 + rad / 30;
    for (let k = 0; k < n; k++) {
      const s = (0.9 + r() * 2.6) * scale;
      puffs.push({ x: cx + (r() - 0.5) * 7 * scale, y: s * (0.15 + r() * 0.35), z: cz + (r() - 0.5) * 5 * scale, s });
    }
  }
  return puffs;
}

let cloudGeometry: THREE.BufferGeometry | null = null;

/** Lumpy spheres: a displaced icosphere so the silhouettes aren't perfect balls. Shared by every cloud bank. */
function getCloudGeometry() {
  if (cloudGeometry) return cloudGeometry;
  const g = new THREE.IcosahedronGeometry(1, 3);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 4.1) * Math.sin(v.y * 3.7 + 1.3) * Math.sin(v.z * 4.6 + 0.7);
    v.multiplyScalar(1 + n * 0.16);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  cloudGeometry = g;
  return g;
}

/** Dark storm-cloud masses hugging the ground, lit gold by whatever light burns nearby. */
export function Clouds(props: CloudsProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  // Layout props are fixed per cloud bank; build once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const puffs = useMemo(() => buildPuffs(props), []);
  const geometry = useMemo(getCloudGeometry, []);
  const last = useRef(-1);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const p = scroll.progress;
    const risen = props.rise ? smooth(range(p, props.rise[0], props.rise[1])) : 1;
    const down = 1 - risen + smooth(range(p, props.sink[0], props.sink[1]));
    if (!mesh.current) return;
    mesh.current.visible = down < 0.999;
    if (Math.abs(down - last.current) < 1e-4) return;
    last.current = down;
    puffs.forEach((pf, i) => {
      dummy.position.set(pf.x, pf.y - Math.min(1, down) * pf.s * 2.2, pf.z);
      dummy.scale.set(pf.s, pf.s * 0.62, pf.s);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, puffs.length]} frustumCulled={false}>
      <meshStandardMaterial color="#3b3a3e" roughness={1} metalness={0} emissive="#0c0c10" envMapIntensity={0.15} />
    </instancedMesh>
  );
}
