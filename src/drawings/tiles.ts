// Full-size templates: a part's outline at 1:1, split over letter pages that overlap so they can be taped together.
import type { Project } from '../model/types'
import { formatInches } from '../model/units'
import type * as THREE from 'three'
import { viewLines } from './lines'
import { esc, num, svgPage, text, viewSvg } from './sheet'
import { FACE } from './views'

export const TILE_PAGE = { w: 8.5, h: 11 }
/** Printers can't print to the edge; this much is left blank all round. */
export const TILE_MARGIN = 0.3
export const OVERLAP = 0.5
const PAD = 0.5
const PW = TILE_PAGE.w - 2 * TILE_MARGIN, PH = TILE_PAGE.h - 2 * TILE_MARGIN
const STEP_W = PW - OVERLAP, STEP_H = PH - OVERLAP

export type Tiling = { cols: number; rows: number; w: number; h: number }
/** How many pages across and down a w × h drawing (inches, 1:1) takes. */
export function tiling(w: number, h: number): Tiling {
  const W = w + 2 * PAD, H = h + 2 * PAD
  return { cols: Math.max(1, Math.ceil((W - OVERLAP) / STEP_W - 1e-9)), rows: Math.max(1, Math.ceil((H - OVERLAP) / STEP_H - 1e-9)), w: W, h: H }
}
/** Tile name: row letter, column number (A1 is top left). */
export const tileName = (row: number, col: number) => `${String.fromCharCode(65 + (row % 26))}${col + 1}`

/** Registration marks: a crosshair in a circle, in the middle of the overlaps (so both pages have it). */
function marks(t: Tiling): [number, number][] {
  const out: [number, number][] = []
  const xs = Array.from({ length: t.cols - 1 }, (_, c) => (c + 1) * STEP_W + OVERLAP / 2)
  const ys = Array.from({ length: t.rows - 1 }, (_, r) => (r + 1) * STEP_H + OVERLAP / 2)
  // Along each vertical overlap: near the top, middle and bottom of every row of pages; and the same across.
  for (const x of xs) for (let r = 0; r < t.rows; r++) for (const f of [0.15, 0.5, 0.85]) out.push([x, r * STEP_H + OVERLAP + f * (STEP_H - OVERLAP)])
  for (const y of ys) for (let c = 0; c < t.cols; c++) for (const f of [0.15, 0.5, 0.85]) out.push([c * STEP_W + OVERLAP + f * (STEP_W - OVERLAP), y])
  return out
}
const target = ([x, y]: [number, number]) =>
  `<circle cx="${num(x)}" cy="${num(y)}" r="0.12" fill="none" stroke="#000" stroke-width="0.01"/>` +
  `<path d="M${num(x - 0.2)} ${num(y)}H${num(x + 0.2)}M${num(x)} ${num(y - 0.2)}V${num(y + 0.2)}" stroke="#000" stroke-width="0.008"/>`

export type Template = { name: string; size: string; tiling: Tiling; pages: string[] }

/** A part's full-size template: a cover page (how to print and check it, and the page map) and its tiles. */
export function template(p: Project, boardId: string, no: number, solids?: Map<string, THREE.BufferGeometry>): Template {
  const b = p.boards.find(x => x.id === boardId)!
  const l = viewLines(p, FACE, { ids: [boardId], local: true, hidden: false, ...(solids ? { solids } : {}) })
  const w = l.max[0] - l.min[0], h = l.max[1] - l.min[1]
  const t = tiling(w, h)
  const toCanvas = (u: number, v: number): [number, number] => [PAD + u - l.min[0], PAD + l.max[1] - v]
  const art = viewSvg(l, toCanvas)
  const title = `P${no} ${b.name}`
  const size = `${formatInches(b.length)} × ${formatInches(b.width)}`
  const all = marks(t)
  const pages: string[] = [cover(title, size, t, k => viewSvg(l, toCanvas, k))]
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      const ox = c * STEP_W, oy = r * STEP_H
      const id = `clip-${boardId}-${r}-${c}`
      let s = `<defs><clipPath id="${esc(id)}"><rect x="${TILE_MARGIN}" y="${TILE_MARGIN}" width="${PW}" height="${PH}"/></clipPath></defs>`
      s += `<g clip-path="url(#${esc(id)})"><g transform="translate(${num(TILE_MARGIN - ox)} ${num(TILE_MARGIN - oy)})">${art}`
      s += all.filter(([x, y]) => x >= ox - 0.3 && x <= ox + PW + 0.3 && y >= oy - 0.3 && y <= oy + PH + 0.3).map(target).join('')
      s += '</g></g>'
      // The page's printed area (trim to it on the left and top) and corner crop marks.
      s += `<rect x="${TILE_MARGIN}" y="${TILE_MARGIN}" width="${PW}" height="${PH}" fill="none" stroke="#999" stroke-width="0.006"/>`
      for (const [x, y] of [[TILE_MARGIN, TILE_MARGIN], [TILE_MARGIN + PW, TILE_MARGIN], [TILE_MARGIN, TILE_MARGIN + PH], [TILE_MARGIN + PW, TILE_MARGIN + PH]]) {
        const dx = x < 1 ? -1 : 1, dy = y < 1 ? -1 : 1
        s += `<path d="M${num(x + dx * 0.05)} ${num(y)}h${num(dx * 0.2)}M${num(x)} ${num(y + dy * 0.05)}v${num(dy * 0.2)}" stroke="#000" stroke-width="0.006"/>`
      }
      const name = tileName(r, c)
      s += text(TILE_PAGE.w / 2, TILE_PAGE.h / 2 + 0.6, name, { anchor: 'middle', size: 1.6, bold: true, fill: '#ececec' })
      s += text(TILE_MARGIN + OVERLAP + 0.1, TILE_PAGE.h - TILE_MARGIN - OVERLAP - 0.1, `${title} · page ${name} of ${tileName(t.rows - 1, t.cols - 1)} (${t.rows} down × ${t.cols} across) · full size`, { size: 0.11 })
      if (c > 0 || r > 0) s += text(TILE_MARGIN + 0.62, TILE_MARGIN + 0.62, `Trim the blank margin off the ${c > 0 && r > 0 ? 'left and top edges' : c > 0 ? 'left edge' : 'top edge'}, then lay this page over the one ${c > 0 ? 'to its left' : 'above'} so the ⊕ marks match`, { size: 0.09, fill: '#666' })
      pages.push(svgPage(TILE_PAGE.w, TILE_PAGE.h, s))
    }
  }
  return { name: title, size, tiling: t, pages }
}

/** The first page: how to print, test squares to check the scale, and a map of the pages. */
function cover(title: string, size: string, t: Tiling, art: (weight: number) => string): string {
  const M = 0.6
  let s = text(M, M + 0.3, `Full-size template — ${title}`, { size: 0.3, bold: true })
  s += text(M, M + 0.65, `${size} · ${t.rows * t.cols} page${t.rows * t.cols === 1 ? '' : 's'} (${t.rows} down × ${t.cols} across)`, { size: 0.16 })
  const lines = [
    'Print at 100% ("Actual size") — not "Fit to page".',
    'Measure both squares below. If they are not exactly 1" and 5 cm, the printer scaled the pages.',
    'Trim the blank margin off the left and top of each page (not A1\'s), lay it over its neighbour so the ⊕ marks match, and tape.',
    'Pages run A1, A2… across the top row, then B1, B2… and so on.'
  ]
  lines.forEach((ln, i) => { s += text(M, M + 1.1 + i * 0.25, `${i + 1}. ${ln}`, { size: 0.13 }) })
  const y = M + 2.3
  s += `<rect x="${M}" y="${y}" width="1" height="1" fill="none" stroke="#000" stroke-width="0.01"/>` + text(M + 0.5, y + 1.25, '1 inch', { anchor: 'middle', size: 0.12 })
  const cm5 = 5 / 2.54
  s += `<rect x="${M + 1.6}" y="${y}" width="${num(cm5)}" height="${num(cm5)}" fill="none" stroke="#000" stroke-width="0.01"/>` + text(M + 1.6 + cm5 / 2, y + cm5 + 0.25, '5 cm', { anchor: 'middle', size: 0.12 })
  // The page map: the drawing shrunk to fit, with the pages over it.
  const mapY = y + cm5 + 0.7, mapW = TILE_PAGE.w - 2 * M, mapH = TILE_PAGE.h - mapY - M
  const k = Math.min(mapW / (t.cols * STEP_W + OVERLAP), mapH / (t.rows * STEP_H + OVERLAP))
  s += text(M, mapY - 0.15, 'Page map', { size: 0.14, bold: true })
  s += `<g transform="translate(${num(M)} ${num(mapY)}) scale(${num(k)})">${art(2.5 / k)}`
  for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) {
    s += `<rect x="${num(c * STEP_W)}" y="${num(r * STEP_H)}" width="${PW}" height="${PH}" fill="none" stroke="#b45309" stroke-width="${num(0.02 / k)}"/>`
    s += `<text x="${num(c * STEP_W + PW / 2)}" y="${num(r * STEP_H + PH / 2)}" font-size="${num(0.3 / k)}" text-anchor="middle" fill="#b45309">${tileName(r, c)}</text>`
  }
  s += '</g>'
  return svgPage(TILE_PAGE.w, TILE_PAGE.h, s)
}
