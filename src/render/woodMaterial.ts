// The realistic wood material: a physical material whose colour is grown in the shader from the part's own
// coordinates — growth rings round a pith line along the grain, fibre streaks, pores, plies on plywood edges.
import * as THREE from 'three'
import type { FinishLook, WoodLook } from './materials'

const NOISE = /* glsl */ `
float wHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float wNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wHash(i), wHash(i + vec3(1,0,0)), f.x), mix(wHash(i + vec3(0,1,0)), wHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(wHash(i + vec3(0,0,1)), wHash(i + vec3(1,0,1)), f.x), mix(wHash(i + vec3(0,1,1)), wHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float wFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * wNoise(p); p *= 2.03; a *= 0.5; } return s; }
`

const WOOD = /* glsl */ `
uniform vec3 uLight; uniform vec3 uDark; uniform float uRing; uniform float uContrast; uniform float uPores; uniform float uStreaks;
uniform float uSeed; uniform float uAlongY; uniform vec2 uPith; uniform int uPattern; uniform float uThick; uniform float uPlies;
uniform vec3 uTint; uniform float uTintAmt; uniform float uAmber; uniform vec3 uPaint; uniform float uPainted;
varying vec3 vWoodPos; varying vec3 vWoodNormal;
${NOISE}
vec3 woodColour() {
  // a: along the grain; u: across the face; v: through the thickness.
  vec3 P = vWoodPos;
  float a = mix(P.x, P.y, uAlongY);
  float u = mix(P.y, P.x, uAlongY);
  float v = P.z;
  vec3 N = normalize(vWoodNormal);
  float endGrain = abs(mix(N.x, N.y, uAlongY));
  vec3 seed = vec3(uSeed * 61.0, uSeed * 17.0, uSeed * 37.0);
  if (uPainted > 0.5) return uPaint;
  if (uPattern == 2) {
    // MDF: even, with a fine speckle; the cut edges a little darker and coarser.
    float n = wNoise(P * 24.0 + seed);
    float edge = 1.0 - abs(N.z);
    return mix(uLight, uDark, 0.25 * n + 0.5 * edge);
  }
  if (uPattern == 1 && abs(N.z) < 0.5) {
    // Plywood edge: plies alternate face grain and end grain; thin dark glue lines between.
    float t = clamp(v / max(uThick, 0.001), 0.0, 0.9999) * uPlies;
    float k = floor(t);
    float glue = smoothstep(0.08, 0.0, fract(t)) + smoothstep(0.92, 1.0, fract(t));
    vec3 ply = mix(uLight, uDark, mod(k, 2.0) * 0.45 + 0.1 * wNoise(vec3(a * 3.0, k, 0.0) + seed));
    return mix(ply, uDark * 0.55, clamp(glue, 0.0, 1.0) * 0.7);
  }
  // Growth rings round the pith line, wandering a little along the board.
  float wobble = (wFbm(vec3(a * 0.045, u * 0.08, v * 0.08) + seed) - 0.5) * 2.2 * uRing * 6.0;
  float r = length(vec2(u - uPith.x, v - uPith.y)) + wobble;
  float ring = fract(r / uRing);
  // Earlywood grows light and fast; latewood is the darker band at the end of each year.
  float late = smoothstep(0.55, 0.92, ring) * (1.0 - smoothstep(0.96, 1.0, ring));
  float streak = wNoise(vec3(a * 0.6, u * 34.0, v * 34.0) + seed) - 0.5;
  float t = clamp(late * uContrast + streak * 0.12 * uStreaks + (wNoise(vec3(a * 0.05, u * 0.3, v * 0.3) + seed) - 0.5) * 0.12, 0.0, 1.0);
  vec3 c = mix(uLight, uDark, t);
  if (uPores > 0.5) {
    // Open pores: dark flecks along the grain in the earlywood.
    float pore = step(0.78, wNoise(vec3(a * 1.2, u * 70.0, v * 70.0) + seed)) * (1.0 - smoothstep(0.0, 0.35, ring));
    c = mix(c, uDark * 0.7, pore * 0.55);
  }
  // End grain soaks up more and reads darker.
  c *= 1.0 - 0.22 * smoothstep(0.5, 0.9, endGrain);
  return c;
}
vec3 finished(vec3 c) {
  if (uPainted > 0.5) return c;
  vec3 N = normalize(vWoodNormal);
  float endGrain = smoothstep(0.5, 0.9, abs(mix(N.x, N.y, uAlongY)));
  float amt = clamp(uTintAmt * (1.0 + 0.3 * endGrain), 0.0, 1.0);
  c = mix(c, c * uTint * 1.6, amt);
  c = mix(c, c * vec3(0.98, 0.86, 0.62), uAmber * 0.5);
  return c;
}
`

export type WoodUniformsIn = { look: WoodLook; finish: FinishLook; seed: number; alongY: boolean; pith: [number, number]; thickness: number }

/** Plies in a sheet this thick (odd, at least 3). */
export const pliesFor = (t: number) => { const n = Math.max(3, Math.round(t / 0.07)); return n % 2 ? n : n + 1 }

export function woodUniforms({ look, finish, seed, alongY, pith, thickness }: WoodUniformsIn) {
  // The look's colours are sRGB; the shader works in linear light.
  const v3 = (c: [number, number, number]) => { const k = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return new THREE.Vector3(k.r, k.g, k.b) }
  return {
    uLight: { value: v3(look.light) }, uDark: { value: v3(look.dark) }, uRing: { value: look.ringSpacing }, uContrast: { value: look.contrast },
    uPores: { value: look.pores ? 1 : 0 }, uStreaks: { value: look.streaks }, uSeed: { value: seed }, uAlongY: { value: alongY ? 1 : 0 },
    uPith: { value: new THREE.Vector2(pith[0], pith[1]) }, uPattern: { value: look.pattern === 'ply' ? 1 : look.pattern === 'mdf' ? 2 : 0 },
    uThick: { value: thickness }, uPlies: { value: pliesFor(thickness) },
    uTint: { value: v3(finish.tint ?? [1, 1, 1]) }, uTintAmt: { value: finish.tint ? finish.tintAmount : 0 }, uAmber: { value: finish.amber },
    uPaint: { value: v3(finish.paint ?? [1, 1, 1]) }, uPainted: { value: finish.paint ? 1 : 0 }
  }
}

/** A physical material drawing this wood and finish. */
export function woodMaterial(input: WoodUniformsIn, clip: THREE.Plane[] = []): THREE.MeshPhysicalMaterial {
  const { finish } = input
  const m = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: finish.roughness, clearcoat: finish.clearcoat, clearcoatRoughness: finish.clearcoatRoughness,
    clippingPlanes: clip, side: THREE.FrontSide
  })
  const uniforms = woodUniforms(input)
  m.userData.wood = uniforms
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWoodPos;\nvarying vec3 vWoodNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWoodPos = position;\nvWoodNormal = normal;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WOOD}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = finished(woodColour());')
  }
  m.customProgramCacheKey = () => 'aa-wood-1'
  return m
}
