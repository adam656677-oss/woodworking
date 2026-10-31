// What each part looks like in the realistic view: the wood's colour and grain, and the finish on it.
// Everything is worked out here as plain numbers; the shader (woodMaterial.ts) only draws them.
import { finishById } from '../finish/finishes'
import { findSpecies, speciesById, type Species } from '../library/species'
import type { Board, FinishSchedule, Wood } from '../model/types'

export type Rgb = [number, number, number]
/** ring: solid wood with growth rings; ply: plywood (face veneer, plies on the edges); mdf: even and plain; paint: solid colour. */
export type Pattern = 'ring' | 'ply' | 'mdf'

export type WoodLook = {
  pattern: Pattern
  /** Earlywood (light) and latewood (dark) colours, 0–1 linear-ish sRGB. */
  light: Rgb
  dark: Rgb
  /** Inches between growth rings. */
  ringSpacing: number
  /** How strongly the rings show, 0–1. */
  contrast: number
  /** Open pores along the rings (oak, ash, elm …). */
  pores: boolean
  /** Fine streaks along the grain, 0–1. */
  streaks: number
  /** Species shown in the legend, if known. */
  speciesId?: string
  label: string
}

export type FinishLook = {
  /** Stain or dye colour multiplied over the wood, and how much. */
  tint: Rgb | null
  tintAmount: number
  /** Warm yellowing of oil-based finishes, 0–1. */
  amber: number
  /** Solid paint colour (hides the grain). */
  paint: Rgb | null
  roughness: number
  clearcoat: number
  clearcoatRoughness: number
  label: string
}

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
export const rgbToHex = (c: Rgb) => '#' + c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')
const scale = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k]
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// Woods whose big earlywood pores show as lines of dots along the rings.
const RING_POROUS = new Set(['white-ash', 'american-chestnut', 'american-elm', 'hackberry', 'hickory', 'pecan', 'honey-locust', 'black-locust', 'red-oak', 'white-oak', 'live-oak', 'sassafras', 'teak', 'iroko', 'wenge'])
// Woods with very even, quiet grain.
const QUIET = new Set(['basswood', 'aspen', 'hard-maple', 'soft-maple', 'paper-birch', 'yellow-birch', 'american-beech', 'european-beech', 'tupelo', 'sweetgum', 'cottonwood', 'black-cherry', 'red-alder', 'yellow-poplar', 'sycamore', 'persimmon'])
// Common shop names that aren't a species' own name.
const ALIASES: [RegExp, string][] = [
  [/\bpine\b/i, 'eastern-white-pine'], [/\boak\b/i, 'red-oak'], [/\bmaple\b/i, 'hard-maple'], [/\bbirch\b/i, 'yellow-birch'],
  [/\bwalnut\b/i, 'black-walnut'], [/\bcherry\b/i, 'black-cherry'], [/\bpoplar\b/i, 'yellow-poplar'], [/\bfir\b/i, 'douglas-fir'],
  [/\bcedar\b/i, 'western-red-cedar'], [/\bspruce\b/i, 'eastern-spruce'], [/\bmahogany\b/i, 'genuine-mahogany'], [/\bash\b/i, 'white-ash']
]

/** The species a name means: the library's own lookup, then common shop words ("Pine", "Oak plywood"). */
export function speciesFor(name: string): Species | undefined {
  const exact = findSpecies(name)
  if (exact) return exact
  for (const [re, id] of ALIASES) if (re.test(name)) return speciesById(id)
  return undefined
}

function ringLook(s: Species | undefined, label: string): WoodLook {
  // An unnamed "Hardwood": a plain, light-brown hardwood.
  const base = hexToRgb(s?.colour ?? '#c9a57e')
  const soft = s?.kind === 'softwood'
  const porous = !!s && RING_POROUS.has(s.id)
  const quiet = !s || QUIET.has(s.id)
  // Dark woods get relatively less dark latewood; light softwoods strong orange-brown latewood.
  const contrast = soft ? 0.55 : porous ? 0.38 : quiet ? 0.16 : 0.26
  const dark = soft ? mix(scale(base, 0.62), [0.62, 0.36, 0.16], 0.25) : scale(base, 0.68)
  return {
    pattern: 'ring', light: mix(base, [1, 1, 1], soft ? 0.06 : 0.03), dark, contrast, pores: porous,
    ringSpacing: soft ? 0.22 : porous ? 0.14 : 0.11, streaks: quiet ? 0.25 : 0.45, speciesId: s?.id, label
  }
}

/** The look of a wood from the project's wood list. */
export function woodLook(wood: Wood | undefined): WoodLook {
  const name = `${wood?.species ?? ''}`.trim()
  if (wood?.kind === 'sheet' || /plywood|\bply\b|mdf|particle/i.test(name)) {
    if (/mdf|particle|hardboard/i.test(name)) {
      const c = /particle/i.test(name) ? hexToRgb('#c2a37c') : hexToRgb('#a98059')
      return { pattern: 'mdf', light: c, dark: scale(c, 0.82), ringSpacing: 1, contrast: 0.08, pores: false, streaks: 0, label: /particle/i.test(name) ? 'Particleboard' : 'MDF' }
    }
    // Plywood: the face veneer's species (birch unless it says otherwise).
    const face = speciesFor(name.replace(/plywood|\bply\b/gi, '').trim()) ?? speciesById('yellow-birch')!
    const r = ringLook(face, `${face.name} plywood`)
    // Rotary-cut faces: wide, wandering figure.
    return { ...r, pattern: 'ply', light: mix(r.light, [1, 1, 1], 0.05), ringSpacing: r.ringSpacing * 2.2, contrast: r.contrast * 0.8, pores: false }
  }
  const s = speciesFor(name)
  return ringLook(s, s?.name ?? (name || 'Wood'))
}

/** A number 0–1 from a part's id, so each part gets its own grain and a slightly different colour. */
export function seedOf(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 100000) / 100000
}

/** The part's own colour: within ±5% of the wood's, a touch warmer or cooler. */
export function varied(look: WoodLook, id: string): WoodLook {
  const s = seedOf(id)
  const k = 0.95 + 0.1 * s
  const warm = (seedOf(id + '~') - 0.5) * 0.04
  const v = (c: Rgb): Rgb => [c[0] * k * (1 + warm), c[1] * k, c[2] * k * (1 - warm)]
  return { ...look, light: v(look.light), dark: v(look.dark) }
}

/**
 * Grain direction in the part's own axes (x = width, y = length, z = thickness): grain runs along the length
 * unless the part says across its width. The growth rings are centred on a line parallel to it, below the
 * part's face (flat-sawn), so the faces show cathedrals and the ends show the rings.
 */
export function grainFrame(board: Pick<Board, 'grain' | 'width' | 'length' | 'thickness' | 'id'>): { along: 'x' | 'y'; pith: [number, number]; across: number } {
  const along = board.grain === 'width' ? 'x' : 'y'
  const across = along === 'y' ? board.width : board.length
  const s = seedOf(board.id)
  // Pith: somewhere across the board and 3–12" below the bottom face.
  return { along, pith: [across * (0.2 + 0.6 * s), -(3 + 9 * seedOf(board.id + '#'))], across }
}

// Stain and dye colours by the words people use on the can.
const STAINS: [RegExp, string][] = [
  [/ebony|jacobean|espresso|black/i, '#3a2a22'], [/dark walnut/i, '#4e3526'], [/walnut/i, '#6b4a33'], [/red mahogany|mahogany/i, '#7a3b28'],
  [/cherry/i, '#9a4e33'], [/golden oak|golden/i, '#c08a48'], [/early american|provincial/i, '#7f5a3a'], [/natural/i, '#d9b98c'],
  [/honey|pecan/i, '#b07a45'], [/grey|gray|weathered/i, '#8a8580'], [/white|pickl|whitewash/i, '#e8e2d6'], [/oak/i, '#a87444'],
  [/blue/i, '#41607d'], [/green/i, '#4f6a46'], [/red/i, '#8a2f24'], [/brown/i, '#6e4b32']
]
const PAINTS: [RegExp, string][] = [
  [/black/i, '#262626'], [/navy|dark blue/i, '#26344a'], [/blue/i, '#5a7fa8'], [/green|sage/i, '#7d9473'], [/red/i, '#a63a2e'],
  [/yellow/i, '#e2c25a'], [/grey|gray/i, '#8f9194'], [/cream|ivory|off-white/i, '#efe7d3'], [/white/i, '#f2f0ea']
]
const firstMatch = (table: [RegExp, string][], text: string) => table.find(([re]) => re.test(text))?.[1]

/** Sheen words → how rough the surface is and how much clear gloss sits on top. */
export function sheenOf(sheen: string | undefined): { roughness: number; clearcoat: number; clearcoatRoughness: number } {
  const s = (sheen ?? '').toLowerCase()
  if (/high|gloss/.test(s) && !/semi/.test(s)) return { roughness: 0.55, clearcoat: 1, clearcoatRoughness: 0.04 }
  if (/semi/.test(s)) return { roughness: 0.6, clearcoat: 0.8, clearcoatRoughness: 0.14 }
  if (/satin|eggshell/.test(s)) return { roughness: 0.65, clearcoat: 0.55, clearcoatRoughness: 0.32 }
  if (/matte|flat/.test(s)) return { roughness: 0.75, clearcoat: 0.25, clearcoatRoughness: 0.6 }
  return { roughness: 0.65, clearcoat: 0.5, clearcoatRoughness: 0.35 }
}

export const RAW: FinishLook = { tint: null, tintAmount: 0, amber: 0, paint: null, roughness: 0.82, clearcoat: 0, clearcoatRoughness: 0.6, label: 'Bare wood' }

/** What the project's finishing schedule does to the look: stain or dye, amber, paint, and the topcoat's sheen. */
export function finishLook(s: FinishSchedule | undefined): FinishLook {
  if (!s || !s.steps.length) return RAW
  let out: FinishLook = { ...RAW, label: s.name }
  let coated = false
  for (const st of s.steps) {
    const f = st.finishId ? finishById(st.finishId) : undefined
    const words = `${st.product ?? ''} ${st.title} ${st.notes ?? ''}`
    if (f?.base === 'paint-latex' || (!f && /\bpaint/i.test(words))) {
      out = { ...out, paint: hexToRgb(firstMatch(PAINTS, words) ?? '#f2f0ea'), ...sheenOf(st.sheen ?? 'Satin') }
      coated = true
      continue
    }
    if (st.kind === 'colour' && f && (f.role === 'colour' || /stain|dye/i.test(f.name))) {
      const hex = firstMatch(STAINS, words) ?? (f.base.startsWith('dye') ? '#8a5a35' : '#7f5a3a')
      // Glaze sits on top and colours less; dyes go deep.
      out = { ...out, tint: hexToRgb(hex), tintAmount: f.id === 'glaze' ? 0.4 : f.base.startsWith('dye') ? 0.85 : 0.7 }
      continue
    }
    if (f && (f.role === 'topcoat' || f.role === 'sealer' || f.id === 'shellac')) {
      if (f.ambers) out = { ...out, amber: Math.max(out.amber, f.base === 'shellac' ? 0.6 : f.base === 'oil' || f.base === 'oil-varnish' ? 1 : 0.75) }
      if (f.role === 'topcoat' || st.kind === 'topcoat') {
        // Oils and wax soak in: a soft low sheen whatever the can says.
        const soaks = f.base === 'oil' || f.base === 'wax' || f.base === 'non-drying' || f.base === 'oil-varnish'
        const sh = sheenOf(st.sheen ?? f.sheens[0])
        out = { ...out, ...(soaks ? { roughness: 0.6, clearcoat: f.base === 'wax' ? 0.35 : 0.2, clearcoatRoughness: 0.45 } : sh) }
        coated = true
      }
    }
  }
  if (!coated && !out.paint) out = { ...out, roughness: RAW.roughness, clearcoat: 0 }
  return out
}

/** The colour a flat face of this wood would show with this finish, as one swatch (legend and tests). */
export function swatch(look: WoodLook, fin: FinishLook): Rgb {
  if (fin.paint) return fin.paint
  let c = mix(look.light, look.dark, look.contrast * 0.4)
  if (fin.tint) c = mix(c, [c[0] * fin.tint[0] * 1.6, c[1] * fin.tint[1] * 1.6, c[2] * fin.tint[2] * 1.6], fin.tintAmount)
  if (fin.amber) c = mix(c, [c[0] * 0.98, c[1] * 0.86, c[2] * 0.62], fin.amber * 0.5)
  return c
}

export type LightPreset = 'studio' | 'workshop' | 'daylight'
export type Lighting = {
  label: string
  background: string
  floor: string
  env: number
  ambient: { color: string; intensity: number }
  hemi?: { sky: string; ground: string; intensity: number }
  key: { color: string; intensity: number; dir: [number, number, number] }
  fill: { color: string; intensity: number; dir: [number, number, number] }
}
export const LIGHTS: Record<LightPreset, Lighting> = {
  studio: { label: 'Studio', background: '#f2eee8', floor: '#e8e2d9', env: 0.9, ambient: { color: '#ffffff', intensity: 0.15 },
    key: { color: '#ffffff', intensity: 2.2, dir: [-0.45, -0.7, 0.85] }, fill: { color: '#e8eeff', intensity: 0.5, dir: [0.7, 0.4, 0.4] } },
  workshop: { label: 'Workshop', background: '#3d3630', floor: '#8f877c', env: 0.45, ambient: { color: '#ffe2bd', intensity: 0.25 },
    key: { color: '#ffd8a6', intensity: 2.6, dir: [-0.15, -0.25, 1] }, fill: { color: '#ffe9cc', intensity: 0.35, dir: [0.8, -0.6, 0.3] } },
  daylight: { label: 'Daylight', background: '#dfe8f1', floor: '#d6d0c3', env: 0.8, ambient: { color: '#ffffff', intensity: 0.05 },
    hemi: { sky: '#cfe2ff', ground: '#b9a688', intensity: 0.6 },
    key: { color: '#fff3df', intensity: 3.2, dir: [0.75, -0.55, 0.55] }, fill: { color: '#cfe2ff', intensity: 0.3, dir: [-0.6, 0.5, 0.5] } }
}

/** Image size for an export: the view's size times the scale, kept to 4096 px on the long side. */
export function exportSize(w: number, h: number, scale: number): { width: number; height: number; ratio: number } {
  const ratio = Math.min(scale, 4096 / Math.max(w, h, 1))
  return { width: Math.round(w * ratio), height: Math.round(h * ratio), ratio }
}
