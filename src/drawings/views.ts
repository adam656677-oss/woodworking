// The drawing sheets: views of the whole design, the exploded view, a section, and one sheet per part.
import * as THREE from 'three'
import { explodeOffsets } from '../checks/explode'
import { localSolids } from '../checks/solids'
import { cutList } from '../model/cutlist'
import { worldBox } from '../model/geometry'
import { cutGeometry, jointNotes, type BoxCut } from '../model/joints'
import { formatInches } from '../model/units'
import type { Project, Vec3 } from '../model/types'
import { viewLines, VIEWS, type Lines, type View } from './lines'
import {
  balloon, chain, dimension, isEven, dimText, drawArea, fitScale, mapper, PAPERS, scaleText, svgPage, table, text, titleBlock, viewSize, viewSvg,
  type Paper, type ScaleChoice
} from './sheet'

export type SheetOpts = { paper: Paper; scale: ScaleChoice; hidden: boolean; date: string }
export type Sheet = { svg: string; paper: Paper; title: string }
type Ctx = SheetOpts & { project: Project; sheetNo: () => string; solids: Map<string, THREE.BufferGeometry> }

/** A part's own coordinates seen square to its face (length across, width up) and its edge (length across, thickness up). */
export const FACE: View = { toViewer: { x: 0, y: 0, z: 1 }, right: { x: 0, y: 1, z: 0 }, up: { x: -1, y: 0, z: 0 } }
export const EDGE: View = { toViewer: { x: 1, y: 0, z: 0 }, right: { x: 0, y: 1, z: 0 }, up: { x: 0, y: 0, z: 1 } }

const GAP = 0.9
const dot = (q: Vec3, d: Vec3) => q.x * d.x + q.y * d.y + q.z * d.z
const label = (x: number, y: number, t: string, sub?: string) => text(x, y, t, { anchor: 'middle', bold: true, size: 0.13 }) + (sub ? text(x, y + 0.16, sub, { anchor: 'middle', size: 0.1 }) : '')

function sheet(c: Ctx, title: string, scale: string, body: string): Sheet {
  const P = PAPERS[c.paper]
  return { paper: c.paper, title, svg: svgPage(P.w, P.h, body + titleBlock(c.paper, { project: c.project.name, title, scale, sheet: c.sheetNo(), date: c.date })) }
}

/** Fit a single view into a box, centred; returns its svg, mapper and scale. */
function fitted(l: Lines, box: { x: number; y: number; w: number; h: number }, scale?: number) {
  const W = l.max[0] - l.min[0], H = l.max[1] - l.min[1]
  const s = scale ?? Math.max(W / box.w, H / box.h, 1e-6)
  const m = mapper(l, s, box.x + (box.w - W / s) / 2, box.y + (box.h - H / s) / 2)
  return { svg: viewSvg(l, m), m, s }
}

/** Sheet 1: front, top and right side views (third-angle), overall sizes, and a picture. */
export function viewsSheet(c: Ctx): Sheet {
  const p = c.project
  const A = drawArea(c.paper)
  const front = viewLines(p, VIEWS.front, { hidden: c.hidden, solids: c.solids })
  const top = viewLines(p, VIEWS.top, { hidden: c.hidden, solids: c.solids })
  const side = viewLines(p, VIEWS.side, { hidden: c.hidden, solids: c.solids })
  const fx = front.max[0] - front.min[0], fz = front.max[1] - front.min[1], dy = side.max[0] - side.min[0]
  const availW = A.w - 0.6 - GAP - 0.3, availH = A.h - 0.6 - GAP - 0.2
  const s = c.scale === 'auto' ? fitScale(fx + dy, dy + fz, availW, availH) : c.scale
  const x0 = A.x + 0.6, yTop = A.y + 0.2, yFront = yTop + dy / s + GAP
  const mf = mapper(front, s, x0, yFront), mt = mapper(top, s, x0, yTop), ms = mapper(side, s, x0 + fx / s + GAP, yFront)
  let body = viewSvg(front, mf) + viewSvg(top, mt) + viewSvg(side, ms)
  const fs = viewSize(front, s), ss = viewSize(side, s)
  // Overall sizes.
  body += dimension(mf(front.min[0], front.min[1]), mf(front.max[0], front.min[1]), -0.35, dimText(fx))
  body += dimension(mf(front.min[0], front.min[1]), mf(front.min[0], front.max[1]), 0.35, dimText(fz))
  body += dimension(ms(side.min[0], side.min[1]), ms(side.max[0], side.min[1]), -0.35, dimText(dy))
  body += label(x0 + fs.w / 2, yFront + fs.h + 0.72, 'FRONT') + label(x0 + fs.w / 2, yFront - GAP + 0.3, 'TOP')
  body += label(x0 + fx / s + GAP + ss.w / 2, yFront + ss.h + 0.72, 'RIGHT SIDE')
  // Where section A–A cuts (front to back, through the middle).
  const cx = (front.min[0] + front.max[0]) / 2
  const [ax, ay0] = mf(cx, front.max[1]), [, ay1] = mf(cx, front.min[1])
  body += `<line x1="${ax}" y1="${ay0 - 0.15}" x2="${ax}" y2="${ay1 + 0.15}" stroke="#000" stroke-width="0.01" stroke-dasharray="0.25 0.05 0.04 0.05"/>`
  body += text(ax + 0.06, ay0 - 0.12, 'A', { bold: true, size: 0.14 }) + text(ax + 0.06, ay1 + 0.24, 'A', { bold: true, size: 0.14 })
  // The picture, where there's room (top right).
  const above = { x: x0 + fx / s + GAP, y: A.y, w: A.x + A.w - (x0 + fx / s + GAP), h: dy / s + GAP - 0.5 }
  const beside = { x: x0 + (fx + dy) / s + GAP + 0.7, y: A.y, w: A.x + A.w - (x0 + (fx + dy) / s + GAP + 0.7), h: A.h - 0.3 }
  const room = (r: typeof above) => Math.min(r.w, r.h)
  const iso = room(beside) > room(above) ? beside : above
  if (iso.w > 1.4 && iso.h > 1.2) {
    const l = viewLines(p, VIEWS.iso, { hidden: false, solids: c.solids })
    body += fitted(l, { ...iso, h: iso.h - 0.25 }).svg + label(iso.x + iso.w / 2, iso.y + iso.h, 'PICTURE', 'not to scale')
  }
  return sheet(c, 'Front, top and side views', scaleText(s), body)
}

/** The exploded picture with a numbered balloon on each part, and the parts table. */
export function explodedSheet(c: Ctx): Sheet {
  const p = c.project
  const A = drawArea(c.paper)
  const offsets = explodeOffsets(p, 1)
  const l = viewLines(p, VIEWS.iso, { hidden: false, offsets, solids: c.solids })
  const tableW = Math.min(4.2, A.w * 0.42)
  const box = { x: A.x + 0.5, y: A.y + 0.5, w: A.w - tableW - 1.2, h: A.h - 1 }
  const f = fitted(l, box)
  let body = f.svg
  const rows = cutList(p).rows
  const nos = new Map<string, number>()
  rows.forEach((r, i) => r.boardIds.forEach(id => nos.set(id, i + 1)))
  // One balloon per part number, pushed out from the picture's middle.
  const mid: [number, number] = [box.x + box.w / 2, box.y + box.h / 2]
  const placed: [number, number][] = []
  const done = new Set<number>()
  for (const b of p.boards) {
    const no = nos.get(b.id)
    if (!no || done.has(no)) continue
    done.add(no)
    const wb = worldBox(b)
    const off = offsets.get(b.id) ?? { x: 0, y: 0, z: 0 }
    const cq = { x: (wb.min.x + wb.max.x) / 2 + off.x, y: (wb.min.y + wb.max.y) / 2 + off.y, z: (wb.min.z + wb.max.z) / 2 + off.z }
    const to = f.m(dot(cq, VIEWS.iso.right), dot(cq, VIEWS.iso.up))
    let dx = to[0] - mid[0], dy = to[1] - mid[1]
    const d = Math.hypot(dx, dy) || 1
    dx /= d; dy /= d
    let r = 0.45
    let at: [number, number] = [to[0] + dx * r, to[1] + dy * r]
    for (let k = 0; k < 12 && placed.some(q => Math.hypot(q[0] - at[0], q[1] - at[1]) < 0.3); k++) { r += 0.15; at = [to[0] + dx * r, to[1] + dy * r] }
    placed.push(at)
    body += balloon(at, to, no)
  }
  const t = table(A.x + A.w - tableW, A.y + 0.2, [0.35, tableW - 2.35, 0.35, 1.65], ['#', 'Part', 'Qty', 'T × W × L'],
    rows.map((r, i) => [`${i + 1}`, r.part, `${r.qty}`, `${formatInches(r.thickness)} × ${formatInches(r.width)} × ${formatInches(r.length)}`]), rows.length > 24 ? 0.08 : 0.1)
  body += t.svg + label(box.x + box.w / 2, A.y + A.h - 0.25, 'EXPLODED VIEW', 'not to scale')
  return sheet(c, 'Exploded view and parts', 'Not to scale', body)
}

/** Section A–A: cut front to back through the middle, seen from the right. */
export function sectionSheet(c: Ctx): Sheet {
  const p = c.project
  const A = drawArea(c.paper)
  const xs = p.boards.flatMap(b => { const w = worldBox(b); return [w.min.x, w.max.x] })
  const at = (Math.min(...xs) + Math.max(...xs)) / 2
  const l = viewLines(p, VIEWS.side, { hidden: c.hidden, clip: { axis: 'x', at, keep: 'low' }, solids: c.solids })
  const W = l.max[0] - l.min[0], H = l.max[1] - l.min[1]
  const s = c.scale === 'auto' ? fitScale(W, H, A.w - 1.4, A.h - 1.2) : c.scale
  const sz = { w: W / s, h: H / s }
  const m = mapper(l, s, A.x + (A.w - sz.w) / 2, A.y + 0.3)
  let body = viewSvg(l, m)
  body += dimension(m(l.min[0], l.min[1]), m(l.max[0], l.min[1]), -0.35, dimText(W))
  body += dimension(m(l.min[0], l.min[1]), m(l.min[0], l.max[1]), 0.35, dimText(H))
  body += label(A.x + A.w / 2, A.y + 0.3 + sz.h + 0.7, 'SECTION A–A', 'cut through the middle, looking at it from the right')
  return sheet(c, 'Section A–A', scaleText(s), body)
}

/** One part, drawn on its own: its face with holes and grooves, its edge, sizes and notes. */
export function partSheet(c: Ctx, boardId: string, no: number, qty: number): Sheet {
  const p = c.project
  const b = p.boards.find(x => x.id === boardId)!
  const A = drawArea(c.paper)
  const face = viewLines(p, FACE, { ids: [b.id], local: true, hidden: c.hidden, solids: c.solids })
  const edge = viewLines(p, EDGE, { ids: [b.id], local: true, hidden: c.hidden, solids: c.solids })
  const notesW = 2.7
  const L = Math.max(face.max[0] - face.min[0], edge.max[0] - edge.min[0]), Wd = face.max[1] - face.min[1], T = edge.max[1] - edge.min[1]
  const s = c.scale === 'auto' ? fitScale(L, Wd + T, A.w - notesW - 1.6, A.h - 1.0 - 2 * GAP) : c.scale
  const x0 = A.x + 0.9, yFace = A.y + 0.75
  const mFace = mapper(face, s, x0, yFace)
  const yEdge = yFace + Wd / s + GAP
  const mEdge = mapper(edge, s, x0, yEdge)
  let body = viewSvg(face, mFace) + viewSvg(edge, mEdge)
  // Face view: U is along the length (0 at the left end), V is across (bottom edge at -width).
  const cuts = cutGeometry(p).filter(k => k.boardId === b.id)
  const holes = cuts.filter(k => k.kind === 'hole') as Extract<(typeof cuts)[number], { kind: 'hole' }>[]
  const grooves = cuts.filter(k => k.kind === 'dado' || k.kind === 'rabbet') as BoxCut[]
  const left = mFace(0, 0)[0], bottomY = mFace(0, -b.width)[1], topY = mFace(0, 0)[1], right = mFace(b.length, 0)[0]
  const sheetU = (u: number) => mFace(u, 0)[0]
  const sheetV = (v: number) => mFace(0, v)[1]
  // Hole positions: along the length above the face, across on its right.
  const holeU = holes.map(h => sheetU(h.center.y)), holeV = holes.map(h => sheetV(-h.center.x))
  const many = new Set(holeU.map(v => v.toFixed(3))).size > 12 && !isEven(holeU, s)
  if (holes.length && !many) {
    body += chain(left, holeU, s, (a, z, t, lv) => dimension([a, topY], [z, topY], 0.3 + lv * 0.3, t))
    body += chain(0, holeV.map(v => bottomY - v), s, (a, z, t, lv) => dimension([right, bottomY - a], [right, bottomY - z], -0.3 - lv * 0.3, t))
  }
  // Grooves across the part: positions along the length, under the edge view.
  const edgeBottom = mEdge(0, 0)[1]
  // Each groove's near side from the left end (its width is in the notes).
  const gU = grooves.filter(g => g.max.x - g.min.x >= b.width - 1e-6 && g.min.y > 1e-6).map(g => sheetU(g.min.y))
  let level = 0
  if (gU.length) {
    let deepest = 0
    body += chain(left, gU, s, (a, z, t, lv) => { deepest = Math.max(deepest, lv); return dimension([a, edgeBottom], [z, edgeBottom], -0.3 - lv * 0.3, t) })
    level = deepest + 1
  }
  // Overall sizes.
  body += dimension([left, edgeBottom], [right, edgeBottom], -0.3 - level * 0.3, dimText(b.length))
  body += dimension([left, bottomY], [left, topY], 0.35, dimText(b.width))
  body += dimension([left, mEdge(0, 0)[1]], [left, mEdge(0, b.thickness)[1]], 0.35, dimText(b.thickness))
  body += text(x0, yFace - (holes.length && !many ? 0.75 : 0.25), 'FACE', { bold: true, size: 0.12 }) + text(x0, yEdge - 0.25, 'EDGE', { bold: true, size: 0.12 })
  // The notes column.
  const row = cutList(p).rows.find(r => r.boardIds.includes(b.id))
  const wood = p.woods.find(w => w.id === b.woodId)
  const nx = A.x + A.w - notesW
  let ny = A.y + 0.2
  const put = (t: string, o: { bold?: boolean; size?: number } = {}) => { body += text(nx, ny, t, { size: o.size ?? 0.11, bold: o.bold }); ny += (o.size ?? 0.11) * 1.6 }
  put(`P${no}  ${b.name}`, { bold: true, size: 0.2 })
  put(`Make ${qty}`, { bold: true, size: 0.14 })
  put(`${formatInches(b.thickness)} × ${formatInches(b.width)} × ${formatInches(b.length)}`)
  if (wood) put(wood.name)
  if (row) put(`Grain runs along the ${row.grain}`)
  if (row?.cutWidth !== undefined || row?.cutLength !== undefined) put(`Cut size ${formatInches(row?.cutWidth ?? b.width)} × ${formatInches(row?.cutLength ?? b.length)}`)
  ny += 0.08
  const notes = [...new Set([...(row?.notes ?? []), ...jointNotes(p, b.id)])]
  if (notes.length) put('Notes', { bold: true, size: 0.12 })
  for (const n of notes) for (const ln of wrap(n, 42)) put(ln, { size: 0.1 })
  if (many) {
    ny += 0.1
    put('Holes (from left end, from bottom edge)', { bold: true, size: 0.11 })
    const t = table(nx, ny, [1.1, 1.1, 0.5], ['Along', 'Up', 'Dia.'], holes.slice(0, 30).map(h => [dimText(h.center.y), dimText(b.width - h.center.x), dimText(h.diameter)]), 0.09)
    body += t.svg
  }
  return sheet(c, `Part P${no} — ${b.name}`, scaleText(s), body)
}

export function wrap(t: string, n: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const w of t.split(' ')) {
    if ((cur + ' ' + w).trim().length > n && cur) { out.push(cur); cur = w } else cur = (cur + ' ' + w).trim()
  }
  if (cur) out.push(cur)
  return out
}

/** The parts that get a part sheet: one per cut-list row (the first part in it), with its number and count. */
export function partList(p: Project): { boardId: string; no: number; qty: number; name: string }[] {
  return cutList(p).rows.map((r, i) => ({ boardId: r.boardIds[0], no: i + 1, qty: r.qty, name: r.part }))
}

export type DrawingSet = { views?: boolean; exploded?: boolean; section?: boolean; parts?: string[] | 'all' }

/** All the sheets asked for, numbered "n of N". */
export function drawingSheets(p: Project, set: DrawingSet, opts: SheetOpts): Sheet[] {
  if (!p.boards.length) return []
  const jobs: ((c: Ctx) => Sheet)[] = []
  if (set.views) jobs.push(viewsSheet)
  if (set.exploded) jobs.push(explodedSheet)
  if (set.section) jobs.push(sectionSheet)
  const parts = partList(p).filter(q => set.parts === 'all' || (set.parts ?? []).includes(q.boardId))
  for (const q of parts) jobs.push(c => partSheet(c, q.boardId, q.no, q.qty))
  let k = 0
  const c: Ctx = { ...opts, project: p, solids: localSolids(p), sheetNo: () => `${++k} of ${jobs.length}` }
  const out = jobs.map(j => j(c))
  for (const g of c.solids.values()) g.dispose()
  return out
}

/** The packet's first page: the picture, overall size and what's in the packet. */
export function coverSheet(p: Project, opts: SheetOpts, contents: string[], sheetNo: string): Sheet {
  const A = drawArea(opts.paper)
  const solids = localSolids(p)
  const l = viewLines(p, VIEWS.iso, { hidden: false, solids })
  for (const g of solids.values()) g.dispose()
  const picW = A.w * 0.6
  let body = fitted(l, { x: A.x + 0.3, y: A.y + 0.3, w: picW - 0.6, h: A.h - 0.6 }).svg
  const xs = p.boards.map(worldBox)
  const size = xs.length ? {
    w: Math.max(...xs.map(b => b.max.x)) - Math.min(...xs.map(b => b.min.x)),
    d: Math.max(...xs.map(b => b.max.y)) - Math.min(...xs.map(b => b.min.y)),
    h: Math.max(...xs.map(b => b.max.z)) - Math.min(...xs.map(b => b.min.z))
  } : { w: 0, d: 0, h: 0 }
  const x = A.x + picW + 0.2
  let y = A.y + 0.5
  const put = (t: string, size = 0.14, bold = false) => { body += text(x, y, t, { size, bold }); y += size * 1.7 }
  put(p.name, 0.36, true)
  put('Plan packet', 0.18)
  y += 0.1
  put(`${formatInches(size.w)} wide × ${formatInches(size.d)} deep × ${formatInches(size.h)} high`)
  const rows = cutList(p).rows
  put(`${rows.reduce((n, r) => n + r.qty, 0)} parts`)
  y += 0.2
  put('In this packet', 0.15, true)
  for (const c of contents) put(`•  ${c}`, 0.13)
  return { paper: opts.paper, title: 'Cover', svg: svgPage(PAPERS[opts.paper].w, PAPERS[opts.paper].h, body + titleBlock(opts.paper, { project: p.name, title: 'Plan packet', scale: 'Not to scale', sheet: sheetNo, date: opts.date })) }
}

/** The design's picture alone, as an SVG sized to fit w × h inches (the kids' packet). */
export function pictureSvg(p: Project, w: number, h: number): string {
  if (!p.boards.length) return ''
  const solids = localSolids(p)
  const l = viewLines(p, VIEWS.iso, { hidden: false, solids })
  for (const g of solids.values()) g.dispose()
  const f = fitted(l, { x: 0.1, y: 0.1, w: w - 0.2, h: h - 0.2 })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}in" height="${h}in" viewBox="0 0 ${w} ${h}">${f.svg.replace(/stroke-width="[\d.]+"/g, 'stroke-width="0.03"')}</svg>`
}
