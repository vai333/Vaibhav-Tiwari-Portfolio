import * as THREE from "three";

/**
 * Additive line material that "draws itself": each vertex carries an `aOrder` in [0, 1] and is
 * shown once `uReveal` passes it, with a bright leading edge.
 */
export function createRevealLineMaterial(color: THREE.ColorRepresentation, intensity = 1.6) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uReveal: { value: 0 },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color(color).multiplyScalar(intensity) },
      uFadeFar: { value: 220 },
    },
    vertexShader: /* glsl */ `
      attribute float aOrder;
      varying float vOrder;
      varying float vDepth;
      void main() {
        vOrder = aOrder;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uReveal;
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform float uFadeFar;
      varying float vOrder;
      varying float vDepth;
      void main() {
        float shown = step(vOrder, uReveal);
        float edge = exp(-pow((uReveal - vOrder) * 30.0, 2.0)) * 2.5;
        float fade = 1.0 - smoothstep(uFadeFar * 0.4, uFadeFar, vDepth);
        float a = shown * uOpacity * fade;
        if (!(a > 0.002)) discard;
        gl_FragColor = vec4(uColor * (1.0 + edge), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

let glowTexture: THREE.Texture | null = null;

/** Soft radial sprite used for halos behind bright objects. */
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

/** Converts an array of [start, end] point pairs into a LineSegments-ready geometry. */
export function lineGeometry(positions: Float32Array, order: Float32Array) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aOrder", new THREE.BufferAttribute(order, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** Sets opacity on a group's root element without re-rendering React. */
export function setHtmlOpacity(el: HTMLElement | null, opacity: number) {
  if (!el) return;
  const o = opacity < 0.01 ? 0 : opacity;
  el.style.opacity = String(o);
  el.style.visibility = o === 0 ? "hidden" : "visible";
}
