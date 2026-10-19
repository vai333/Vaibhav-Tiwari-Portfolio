import * as THREE from "three";

/** Uniforms shared by every street-scene material, updated once per frame by the Scale phase. */
export const streetUniforms = {
  uSkyTop: { value: new THREE.Color("#3f7c94") },
  uSkyLow: { value: new THREE.Color("#f4bd7c") },
  uSunDir: { value: new THREE.Vector3(0, 0.06, -1).normalize() },
  uDay: { value: 0 },
};

const VERTEX_PARS = /* glsl */ `
  varying vec3 vWPos;
  varying vec3 vWNormal;
  varying float vSeed;
`;

const VERTEX_MAIN = /* glsl */ `
  vec4 wp4 = vec4(transformed, 1.0);
  vec3 wn = objectNormal;
  vec3 bc = vec3(0.0);
  #ifdef USE_INSTANCING
    wp4 = instanceMatrix * wp4;
    wn = mat3(instanceMatrix) * wn;
    bc = instanceMatrix[3].xyz;
  #endif
  vWPos = (modelMatrix * wp4).xyz;
  vWNormal = normalize(mat3(modelMatrix) * wn);
  vSeed = fract(sin(dot(bc.xz, vec2(12.9898, 78.233))) * 43758.5453);
`;

const FRAGMENT_PARS = /* glsl */ `
  uniform vec3 uSkyTop;
  uniform vec3 uSkyLow;
  uniform vec3 uSunDir;
  uniform float uDay;
  varying vec3 vWPos;
  varying vec3 vWNormal;
  varying float vSeed;
  float fHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
  // Anti-aliased box inside a repeating cell: 1 inside [lo, hi] on both axes of f = fract(g).
  float aaBox(vec2 f, vec2 lo, vec2 hi, vec2 w) {
    vec2 a = smoothstep(lo - w, lo + w, f) * (1.0 - smoothstep(hi - w, hi + w, f));
    return a.x * a.y;
  }

  /** What a pane of glass facing along R would mirror: golden horizon, teal sky, the sun, dark street. */
  vec3 skyReflection(vec3 R) {
    vec3 sky = mix(uSkyLow, uSkyTop, smoothstep(-0.02, 0.45, R.y));
    float s = max(dot(R, normalize(uSunDir)), 0.0);
    sky += vec3(1.0, 0.55, 0.22) * (pow(s, 10.0) * 0.9 + pow(s, 300.0) * 3.0);
    return mix(vec3(0.07, 0.065, 0.06), sky, smoothstep(-0.12, 0.04, R.y));
  }
`;

/**
 * Facade detail for a box tower, generated in world space so it stays put while the boxes scale:
 * "glass" towers get a curtain wall (mullions, spandrels, sky-mirroring panes); "stone" towers get
 * punched windows over a weathered masonry wall and a glazed shopfront at street level. Distant
 * facades fade to a plain tone so they don't shimmer.
 */
export function createFacadeMaterial(kind: "glass" | "stone") {
  const glass = kind === "glass";
  const material = new THREE.MeshStandardMaterial({
    roughness: glass ? 0.4 : 0.88,
    metalness: glass ? 0.2 : 0,
    envMapIntensity: 0.2,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, streetUniforms);
    shader.defines = { ...shader.defines, ...(glass ? { FACADE_GLASS: "" } : {}) };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERTEX_PARS}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERTEX_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_PARS}`)
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        vec3 fN = normalize(vWNormal);
        // Far facades (or any whose window cells shrink below a few pixels) fade to their average tone.
        float fFar = smoothstep(150.0, 420.0, length(cameraPosition - vWPos));
        float pane = 0.0;
        float lit = 0.0;
        if (abs(fN.y) < 0.5) {
          float u = abs(fN.x) > 0.5 ? vWPos.z : vWPos.x;
          float y = vWPos.y;
          #ifdef FACADE_GLASS
            vec2 g = vec2(u / (0.75 + floor(vSeed * 3.0) * 0.18), y / 1.75);
            vec2 f = fract(g);
            vec2 fw = fwidth(g);
            fFar = max(fFar, smoothstep(0.18, 0.45, max(fw.x, fw.y)));
            pane = mix(aaBox(f, vec2(0.07, 0.2), vec2(0.93, 1.02), fw), 0.7, fFar);
            // Mullions and spandrels read as a lighter anodised metal; the glass itself is dark.
            diffuseColor.rgb = mix(diffuseColor.rgb * 1.3 + 0.03, diffuseColor.rgb * 0.15, pane);
          #else
            vec2 g = vec2(u / (1.05 + floor(vSeed * 4.0) * 0.15), y / 1.7);
            vec2 f = fract(g);
            vec2 fw = fwidth(g);
            fFar = max(fFar, smoothstep(0.18, 0.45, max(fw.x, fw.y)));
            pane = mix(aaBox(f, vec2(0.26, 0.3), vec2(0.74, 0.86), fw), 0.3, fFar);
            // Shopfronts: tall glazing on the ground floor.
            float shop = 1.0 - step(2.6, y);
            pane = mix(pane, step(0.06, fract(u / 2.4)) * step(0.25, y) * step(y, 2.2), shop);
            // Weathering streaks and a cornice band every few floors.
            diffuseColor.rgb *= 0.88 + 0.12 * sin(u * 2.7 + vSeed * 20.0) * sin(y * 0.45 + vSeed * 9.0);
            diffuseColor.rgb *= 1.0 - 0.18 * step(0.94, fract(y / 8.5)) * (1.0 - fFar);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.055, 0.06), pane);
          #endif
          lit = pane * step(0.95, fHash(floor(g) + vSeed * 31.0)) * (1.0 - fFar);
        } else {
          diffuseColor.rgb *= 0.62; // gravel roofs
        }
        // Down in the canyon less sky reaches the walls.
        diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 24.0, vWPos.y));`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, pane);",
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        {
          vec3 V = normalize(cameraPosition - vWPos);
          vec3 R = reflect(-V, fN);
          float fres = pow(1.0 - max(dot(fN, V), 0.0), 5.0);
          #ifdef FACADE_GLASS
            float amount = mix(0.5, 1.0, fres);
            float distant = 0.45;
          #else
            float amount = mix(0.3, 0.9, fres);
            float distant = 0.12;
          #endif
          // Low panes mostly mirror the buildings opposite, not the sky.
          amount *= mix(0.35, 1.0, smoothstep(2.0, 30.0, vWPos.y));
          float wall = abs(fN.y) < 0.5 ? 1.0 : 0.0;
          float k = pane * mix(amount, distant / 0.5, fFar) * wall;
          totalEmissiveRadiance += skyReflection(R) * k * uDay;
          totalEmissiveRadiance += vec3(1.0, 0.62, 0.3) * lit * (1.0 - fFar) * mix(1.2, 0.35, uDay);
        }`,
      );
  };
  material.customProgramCacheKey = () => `facade-${kind}`;
  return material;
}

/**
 * Lets a polished metal (the gold hub tower) mirror the street sky in daylight, tinted by `tint`, so it
 * doesn't read as a black pole against the reflective towers around it.
 */
export function addSkyReflection<M extends THREE.MeshStandardMaterial>(material: M, tint: THREE.ColorRepresentation, strength = 1) {
  const t = new THREE.Color(tint);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, streetUniforms, { uTint: { value: t }, uStrength: { value: strength } });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERTEX_PARS}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERTEX_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_PARS}\nuniform vec3 uTint;\nuniform float uStrength;`)
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        {
          vec3 V = normalize(cameraPosition - vWPos);
          vec3 R = reflect(-V, normalize(vWNormal));
          totalEmissiveRadiance += skyReflection(R) * uTint * uStrength * uDay;
        }`,
      );
  };
  material.customProgramCacheKey = () => "sky-reflect";
  return material;
}

/**
 * Asphalt streets with lane markings, crosswalks and concrete sidewalks, painted in world space on one
 * big ground plane. The avenue runs along z at x = 0; the cross street along x at z = `crossZ`.
 */
export function createStreetMaterial(crossZ: number) {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, envMapIntensity: 0.2, transparent: true });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, streetUniforms, { uCrossZ: { value: crossZ } });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERTEX_PARS}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERTEX_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_PARS}\nuniform float uCrossZ;`)
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        vec2 q = vWPos.xz;
        float ax = abs(q.x);
        float cz = abs(q.y - uCrossZ);
        float grain = fHash(floor(q * 6.0)) * 0.5 + fHash(floor(q * 1.3)) * 0.5;
        vec3 asphalt = vec3(0.13, 0.125, 0.122) * (0.85 + grain * 0.3);
        vec3 concrete = vec3(0.42, 0.395, 0.37) * (0.9 + grain * 0.15);
        vec3 col = vec3(0.2, 0.19, 0.18) * (0.85 + grain * 0.2); // between buildings
        float road = max(step(ax, 3.8), step(cz, 3.8));
        float walk = max(step(ax, 5.1), step(cz, 5.1)) * (1.0 - road);
        // Sidewalk slabs.
        vec2 slab = abs(fract(q / 1.5) - 0.5);
        col = mix(col, concrete * (1.0 - 0.25 * step(0.46, max(slab.x, slab.y))), walk);
        col = mix(col, asphalt, road);
        float paint = 0.0;
        vec3 paintCol = vec3(0.9);
        float inCross = step(cz, 5.1);
        float onAvenue = step(ax, 3.8) * (1.0 - inCross);
        float onCross = step(cz, 3.8) * step(5.1, ax);
        // Double yellow centre lines.
        float yellow = onAvenue * step(abs(ax - 0.2), 0.065) + onCross * step(abs(cz - 0.2), 0.065);
        // Dashed white lane lines.
        float dashA = onAvenue * step(abs(ax - 1.95), 0.06) * step(fract(q.y / 7.0), 0.45);
        float dashC = onCross * step(abs(cz - 1.95), 0.06) * step(fract(q.x / 7.0), 0.45);
        // Zebra crossings at the intersection edges and at every side street.
        float side = abs(fract((q.y - uCrossZ - 4.0) / 8.0 + 0.5) - 0.5) * 8.0;
        float zebraA = step(ax, 3.6) * (step(abs(cz - 6.2), 0.9) + step(side, 0.9) * (1.0 - inCross)) * step(0.5, fract(q.x / 0.9));
        float zebraC = step(cz, 3.6) * step(abs(ax - 6.2), 0.9) * step(0.5, fract(q.y / 0.9));
        paint = clamp(dashA + dashC + zebraA + zebraC, 0.0, 1.0);
        float worn = 0.75 + 0.25 * fHash(floor(q * 3.0));
        col = mix(col, vec3(0.82, 0.8, 0.76) * worn, paint);
        col = mix(col, vec3(0.86, 0.58, 0.1) * worn, clamp(yellow, 0.0, 1.0));
        diffuseColor.rgb = col;
        float marking = clamp(paint + yellow, 0.0, 1.0);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(mix(0.92, 0.62, road), 0.5, marking);",
      );
  };
  material.customProgramCacheKey = () => "street";
  return material;
}
