// A board's face drawn in 2D with the same idea as the realistic view's shader: growth rings round a pith
// below the face, wobbling a little, with fibre streaks and pores. Plain arithmetic so tests can run it.
import type { WoodLook } from '../render/materials'

const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s) }
function noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

/** RGBA pixels of a face `w` × `h` pixels showing `inches` of board length across. */
export function grainPixels(look: WoodLook, w: number, h: number, inches: number, seed: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4)
  const k = inches / w
  const pith = [h * k * (0.3 + 0.4 * seed), -(3 + 6 * seed)]
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const a = px * k, u = py * k
    const wob = (noise(a * 0.15 + seed * 40, u * 0.6) - 0.5) * look.ringSpacing * 9
    const r = Math.hypot(u - pith[0], 0.4 - pith[1]) + wob + a * 0.02
    const ring = r / look.ringSpacing - Math.floor(r / look.ringSpacing)
    const late = ring > 0.55 ? Math.min(1, (ring - 0.55) / 0.35) * (ring > 0.96 ? (1 - ring) / 0.04 : 1) : 0
    const streak = noise(a * 0.8, u * 40 + seed * 9) - 0.5
    let t = Math.max(0, Math.min(1, late * look.contrast + streak * 0.14 * look.streaks))
    if (look.pores && ring < 0.3 && noise(a * 3, u * 60) > 0.78) t = Math.min(1, t + 0.35)
    const i = (py * w + px) * 4
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(255 * (look.light[c] + (look.dark[c] - look.light[c]) * t))
    out[i + 3] = 255
  }
  return out
}
