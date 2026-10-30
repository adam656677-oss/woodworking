// Shop-drawing sheets as SVG, measured in inches (1 SVG unit = 1 inch on paper, y down).
import { formatInches } from '../model/units'
import type { Lines } from './lines'

export type Paper = 'letter' | 'tabloid'
/** Sheets are landscape; templates are portrait letter. */
export const PAPERS: Record<Paper, { w: number; h: number; label: string }> = {
  letter: { w: 11, h: 8.5, label: 'Letter (8½ × 11)' },
  tabloid: { w: 17, h: 11, label: 'Tabloid (11 × 17)' }
}
/** Drawing scales, 1:N. */
export const SCALES = [1, 2, 4, 8, 12, 16]
export type ScaleChoice = 'auto' | number

export const MARGIN = 0.4
export const TITLE_H = 0.8
const TEXT = 0.14
const LINE = 0.012
const THIN = 0.007

/** The drawing area of a sheet (above the title block). */
export function drawArea(paper: Paper) {
  const P = PAPERS[paper]
  return { x: MARGIN, y: MARGIN, w: P.w - 2 * MARGIN, h: P.h - 2 * MARGIN - TITLE_H }
}

/** The smallest-reduction scale at which a w × h drawing fits a box (the largest scale if nothing fits). */
export function fitScale(w: number, h: number, boxW: number, boxH: number): number {
  for (const s of SCALES) if (w / s <= boxW + 1e-9 && h / s <= boxH + 1e-9) return s
  return SCALES[SCALES.length - 1]
}
export const scaleText = (s: number) => (s === 1 ? 'Full size (1:1)' : `1:${s}`)

export const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const num = (v: number) => String(Math.round(v * 1e4) / 1e4)

export function svgPage(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}in" height="${h}in" viewBox="0 0 ${w} ${h}" font-family="Arial, Helvetica, sans-serif" stroke-linecap="round">` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="#fff"/>${body}</svg>`
}

export function text(x: number, y: number, t: string, o: { size?: number; anchor?: 'start' | 'middle' | 'end'; bold?: boolean; rotate?: number; fill?: string } = {}): string {
  const r = o.rotate ? ` transform="rotate(${o.rotate} ${num(x)} ${num(y)})"` : ''
  return `<text x="${num(x)}" y="${num(y)}" font-size="${o.size ?? TEXT}" text-anchor="${o.anchor ?? 'start'}"${o.bold ? ' font-weight="bold"' : ''} fill="${o.fill ?? '#000'}"${r}>${esc(t)}</text>`
}
const line = (a: [number, number], b: [number, number], w = THIN, extra = '') => `<line x1="${num(a[0])}" y1="${num(a[1])}" x2="${num(b[0])}" y2="${num(b[1])}" stroke="#000" stroke-width="${w}"${extra}/>`

/** The title block along the bottom of a sheet. */
export function titleBlock(paper: Paper, t: { project: string; title: string; scale: string; sheet: string; date: string }): string {
  const P = PAPERS[paper]
  const x = MARGIN, y = P.h - MARGIN - TITLE_H, w = P.w - 2 * MARGIN
  const cols = [0, 0.42, 0.62, 0.78, 1].map(f => x + f * w)
  let s = `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${TITLE_H}" fill="none" stroke="#000" stroke-width="${LINE * 1.5}"/>`
  for (const c of cols.slice(1, -1)) s += line([c, y], [c, y + TITLE_H], LINE)
  const cell = (i: number, label: string, value: string, big = false) =>
    text(cols[i] + 0.08, y + 0.2, label, { size: 0.09, fill: '#555' }) + text(cols[i] + 0.08, y + (big ? 0.55 : 0.5), value, { size: big ? 0.22 : 0.16, bold: big })
  s += text(cols[0] + 0.08, y + 0.2, 'A&A WOODWORKING STUDIO', { size: 0.09, fill: '#555', bold: true })
  s += text(cols[0] + 0.08, y + 0.5, t.project, { size: 0.22, bold: true })
  s += text(cols[0] + 0.08, y + 0.7, t.title, { size: 0.12 })
  s += cell(1, 'SCALE', t.scale)
  s += cell(2, 'DATE', t.date)
  s += cell(3, 'SHEET', t.sheet, true)
  s += text(cols[1] + 0.08, y + 0.7, 'All sizes in inches', { size: 0.09, fill: '#555' })
  return s
}

/** Maps a view's model coordinates (inches, y up) onto a sheet at 1:s with the view's corner at (x, y) top-left. */
export type Mapper = (u: number, v: number) => [number, number]
export function mapper(l: Lines, s: number, x: number, y: number): Mapper {
  return (u, v) => [x + (u - l.min[0]) / s, y + (l.max[1] - v) / s]
}
export const viewSize = (l: Lines, s: number) => ({ w: (l.max[0] - l.min[0]) / s, h: (l.max[1] - l.min[1]) / s })

/** A view's line work: visible lines solid and heavier, hidden lines thin and dashed. */
export function viewSvg(l: Lines, m: Mapper, weight = 1): string {
  let vis = '', hid = '', cut = ''
  for (const t of l.cut ?? []) { const q = t.map(v => m(v[0], v[1])); cut += `M${q.map(v => `${num(v[0])} ${num(v[1])}`).join('L')}Z` }
  for (const s of l.segs) {
    const a = m(s.a[0], s.a[1]), b = m(s.b[0], s.b[1])
    const d = `M${num(a[0])} ${num(a[1])}L${num(b[0])} ${num(b[1])}`
    if (s.hidden) hid += d
    else vis += d
  }
  return (cut ? `<path d="${cut}" fill="#c9c9c9" stroke="#c9c9c9" stroke-width="0.004"/>` : '') + (hid ? `<path d="${hid}" fill="none" stroke="#000" stroke-width="${num(THIN * weight)}" stroke-dasharray="${num(0.06 * weight)} ${num(0.04 * weight)}"/>` : '') +
    (vis ? `<path d="${vis}" fill="none" stroke="#000" stroke-width="${num(LINE * 1.4 * weight)}"/>` : '')
}

/**
 * A dimension between two sheet points, set off to one side by `off` inches (positive is to the left of a → b,
 * i.e. above a left-to-right line). Extension lines, a dimension line with slash ticks, and the size above it.
 */
export function dimension(a: [number, number], b: [number, number], off: number, label: string): string {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return ''
  const ux = dx / len, uy = dy / len
  // Left of a → b on a y-down sheet.
  const nx = uy, ny = -ux
  const gap = 0.04 * Math.sign(off || 1)
  const pa: [number, number] = [a[0] + nx * off, a[1] + ny * off], pb: [number, number] = [b[0] + nx * off, b[1] + ny * off]
  let s = line([a[0] + nx * gap, a[1] + ny * gap], [pa[0] + nx * 0.06 * Math.sign(off || 1), pa[1] + ny * 0.06 * Math.sign(off || 1)])
  s += line([b[0] + nx * gap, b[1] + ny * gap], [pb[0] + nx * 0.06 * Math.sign(off || 1), pb[1] + ny * 0.06 * Math.sign(off || 1)])
  s += line(pa, pb)
  // Architectural ticks: short slashes at 45°.
  const t = 0.05
  for (const p of [pa, pb]) s += line([p[0] - (ux + nx) * t, p[1] - (uy + ny) * t], [p[0] + (ux + nx) * t, p[1] + (uy + ny) * t], LINE)
  // Text reads left to right or bottom to top, on the outside of the dimension line.
  let ang = (Math.atan2(dy, dx) * 180) / Math.PI
  if (ang > 90.01) ang -= 180
  if (ang <= -90.01) ang += 180
  const rad = (ang * Math.PI) / 180
  const up = [Math.sin(rad), -Math.cos(rad)]
  const sg = Math.sign(off || 1)
  const ox = nx * sg, oy = ny * sg
  const above = ox * up[0] + oy * up[1] > 0
  if (len < 0.45) {
    // Too short for the text between the ticks: it goes beside the dimension, level.
    const across = Math.abs(ox) > Math.abs(oy)
    // A vertical dimension: text out to the side. A level one: text just left of it, on the line.
    const tx = across ? (pa[0] + pb[0]) / 2 + ox * 0.08 : Math.min(pa[0], pb[0]) - 0.1
    const ty = across ? (pa[1] + pb[1]) / 2 + 0.045 : pa[1] + 0.045
    s += `<text x="${num(tx)}" y="${num(ty)}" font-size="${TEXT}" text-anchor="${across ? (ox > 0 ? 'start' : 'end') : 'end'}">${esc(label)}</text>`
    return `<g class="dim">${s}</g>`
  }
  const tx = (pa[0] + pb[0]) / 2 + ox * 0.04, ty = (pa[1] + pb[1]) / 2 + oy * 0.04
  s += `<text x="${num(tx)}" y="${num(ty)}" font-size="${TEXT}" text-anchor="middle" dominant-baseline="${above ? 'auto' : 'hanging'}" transform="rotate(${num(ang)} ${num(tx)} ${num(ty)})">${esc(label)}</text>`
  return `<g class="dim">${s}</g>`
}

/** A size as a dimension label. */
export const dimText = (n: number) => formatInches(n)

/** A small leader and note. */
export function leader(from: [number, number], to: [number, number], note: string): string {
  return line(from, to) + `<circle cx="${num(from[0])}" cy="${num(from[1])}" r="0.02" fill="#000"/>` + text(to[0] + (to[0] >= from[0] ? 0.04 : -0.04), to[1] + 0.04, note, { anchor: to[0] >= from[0] ? 'start' : 'end', size: 0.11 })
}

/** A numbered balloon (part number) with a leader to the part. */
export function balloon(at: [number, number], to: [number, number], no: number): string {
  const r = 0.13
  const d = Math.hypot(to[0] - at[0], to[1] - at[1]) || 1
  const edge: [number, number] = [at[0] + ((to[0] - at[0]) / d) * r, at[1] + ((to[1] - at[1]) / d) * r]
  return line(edge, to) + `<circle cx="${num(to[0])}" cy="${num(to[1])}" r="0.02" fill="#000"/>` +
    `<circle cx="${num(at[0])}" cy="${num(at[1])}" r="${r}" fill="#fff" stroke="#000" stroke-width="${LINE}"/>` +
    text(at[0], at[1] + 0.045, String(no), { anchor: 'middle', size: 0.13, bold: true })
}

/** A simple table: header row plus rows, at (x, y), with column widths in inches. Returns its height too. */
export function table(x: number, y: number, widths: number[], head: string[], rows: string[][], size = 0.1): { svg: string; h: number } {
  const rh = size * 1.7
  let s = ''
  const all = [head, ...rows]
  all.forEach((r, i) => {
    let cx = x
    r.forEach((c, k) => {
      const max = Math.floor(widths[k] / (size * 0.55))
      s += text(cx + 0.04, y + rh * (i + 1) - rh * 0.3, c.length > max ? `${c.slice(0, max - 1)}…` : c, { size, bold: i === 0 })
      cx += widths[k]
    })
    s += line([x, y + rh * (i + 1)], [x + widths.reduce((a, b) => a + b, 0), y + rh * (i + 1)], i === 0 ? LINE : THIN * 0.7)
  })
  return { svg: s, h: rh * all.length }
}

/** Three or more positions (sheet inches at 1:scale) evenly spaced, allowing the 1/64" the design snaps to. */
export function isEven(xs: number[], scale: number): boolean {
  const v = [...new Set(xs.map(x => Math.round(x * 1e4) / 1e4))].sort((a, b) => a - b)
  if (v.length < 3) return false
  const d = (v[v.length - 1] - v[0]) / (v.length - 1)
  return d > 1e-6 && v.every((x, i) => Math.abs(x - (v[0] + i * d)) * scale <= 1 / 64 + 1e-3)
}
/** A spacing in inches, or in millimetres when it's on the 32 mm system (shelf-pin holes). */
export function spacingText(d: number): string {
  const mm = d * 25.4
  return mm >= 31 && Math.abs(mm - 32 * Math.round(mm / 32)) < 0.3 && Math.abs(d * 32 - Math.round(d * 32)) > 0.15 ? `${Math.round(mm)} mm` : dimText(d)
}

/**
 * Dimensions for a row of positions along one direction (sheet inches), measured from `start`:
 * three or more equally spaced positions get one dimension to the first and an "N × spacing (eq. sp.)" note;
 * otherwise a chain of dimensions. `place(a, b, label, level)` draws one.
 */
export function chain(start: number, at: number[], scale: number, place: (a: number, b: number, label: string, level: number) => string): string {
  const xs = [...new Set(at.map(v => Math.round(v * 1e4) / 1e4))].sort((a, b) => a - b)
  if (!xs.length) return ''
  if (isEven(xs, scale)) {
    const n = xs.length - 1, span = (xs[n] - xs[0]) * scale
    return place(start, xs[0], dimText((xs[0] - start) * scale), 0) +
      place(xs[0], xs[n], `${n} × ${spacingText(span / n)} = ${dimText(span)} (eq. sp.)`, 1)
  }
  let s = ''
  let prev = start
  // Each size is the difference of the rounded positions, so the chain adds up to what a tape from the end reads.
  const r32 = (v: number) => Math.round(v * scale * 32) / 32
  for (const v of xs) { s += place(prev, v, dimText(r32(v - start) - r32(prev - start)), 0); prev = v }
  return s
}
