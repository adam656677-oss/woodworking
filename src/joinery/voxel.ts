// The joint designer's model: two beams sharing an n×n×n grid of cells, each cell belonging to beam A (0) or
// beam B (1), and the checks — does each beam hold together, can it be put together (and which way), can every
// cut be reached with a chisel or router, and where is it weak.
import type { CustomJoint } from '../model/types'

export type Dir = CustomJoint['slide']
export const DIRS: Dir[] = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-']
const STEP: Record<Dir, [number, number, number]> = { 'x+': [1, 0, 0], 'x-': [-1, 0, 0], 'y+': [0, 1, 0], 'y-': [0, -1, 0], 'z+': [0, 0, 1], 'z-': [0, 0, -1] }

export type Grid = { n: number; layout: CustomJoint['layout']; cells: string }
export const idx = (n: number, i: number, j: number, k: number) => i + n * (j + n * k)
export const at = (g: Grid, i: number, j: number, k: number) => g.cells[idx(g.n, i, j, k)]
export function setCell(g: Grid, i: number, j: number, k: number, v: '0' | '1'): Grid {
  const a = g.cells.split('')
  a[idx(g.n, i, j, k)] = v
  return { ...g, cells: a.join('') }
}

/**
 * Where each beam's body joins the grid. Inline: A comes in from the x− face, B from the x+ face (end to end).
 * Cross: A runs through along x (both x faces), B along y (both y faces).
 */
export function attached(layout: Grid['layout'], beam: '0' | '1'): Dir[] {
  if (layout === 'inline') return beam === '0' ? ['x-'] : ['x+']
  return beam === '0' ? ['x-', 'x+'] : ['y-', 'y+']
}
const onFace = (n: number, d: Dir, i: number, j: number, k: number) =>
  (d === 'x-' && i === 0) || (d === 'x+' && i === n - 1) || (d === 'y-' && j === 0) || (d === 'y+' && j === n - 1) || (d === 'z-' && k === 0) || (d === 'z+' && k === n - 1)

function each(n: number, f: (i: number, j: number, k: number) => void) {
  for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) f(i, j, k)
}

function neighbours(n: number, c: number): number[] {
  const i = c % n, j = Math.floor(c / n) % n, k = Math.floor(c / (n * n))
  const out: number[] = []
  for (const [di, dj, dk] of Object.values(STEP)) {
    const a = i + di, b = j + dj, e = k + dk
    if (a >= 0 && b >= 0 && e >= 0 && a < n && b < n && e < n) out.push(idx(n, a, b, e))
  }
  return out
}

/** Cells of a beam not joined (face to face) to the beam's body, and how many separate loose pieces they make. */
export function loosePieces(g: Grid, beam: '0' | '1'): { loose: number[]; pieces: number } {
  const n = g.n
  const faces = attached(g.layout, beam)
  const seen = new Set<number>()
  const flood = (start: number[]) => {
    const st = [...start]
    for (const s0 of start) seen.add(s0)
    while (st.length) for (const q of neighbours(n, st.pop()!)) if (!seen.has(q) && g.cells[q] === beam) { seen.add(q); st.push(q) }
  }
  const roots: number[] = []
  each(n, (i, j, k) => { if (at(g, i, j, k) === beam && faces.some(d => onFace(n, d, i, j, k))) roots.push(idx(n, i, j, k)) })
  flood(roots)
  const loose: number[] = []
  each(n, (i, j, k) => { const c = idx(n, i, j, k); if (g.cells[c] === beam && !seen.has(c)) loose.push(c) })
  let pieces = 0
  for (const c of loose) if (!seen.has(c)) { pieces++; flood([c]) }
  return { loose, pieces }
}

/** Can beam B slide out of beam A along this direction? Every B cell's path out must be clear of A, and not run into A's body. */
export function slides(g: Grid, d: Dir): boolean {
  const n = g.n
  const [di, dj, dk] = STEP[d]
  if (attached(g.layout, '0').includes(d)) {
    // Leaving the grid through a face where A's body is: any B cell in a line to that face is blocked.
    let blocked = false
    each(n, (i, j, k) => { if (!blocked && at(g, i, j, k) === '1') blocked = true })
    if (blocked) return false
  }
  // B's own body on the far side follows it into the grid, sweeping the whole section: any A cell blocks it.
  const opposite = (d.endsWith('+') ? `${d[0]}-` : `${d[0]}+`) as Dir
  if (attached(g.layout, '1').includes(opposite) && g.cells.includes('0')) return false
  let ok = true
  each(n, (i, j, k) => {
    if (!ok || at(g, i, j, k) !== '1') return
    for (let a = i + di, b = j + dj, e = k + dk; a >= 0 && b >= 0 && e >= 0 && a < n && b < n && e < n; a += di, b += dj, e += dk) {
      if (at(g, a, b, e) === '0') { ok = false; return }
    }
  })
  return ok
}
export const slideDirs = (g: Grid) => DIRS.filter(d => slides(g, d))

/** Cells cut out of a beam that no straight tool can reach from outside (a cut buried behind the beam's own wood). */
export function unreachable(g: Grid, beam: '0' | '1'): number[] {
  const n = g.n
  const other = beam === '0' ? '1' : '0'
  const body = attached(g.layout, beam)
  const out: number[] = []
  each(n, (i, j, k) => {
    if (at(g, i, j, k) !== other) return
    // A tool comes in along some axis, through only removed cells, and from a side that isn't the beam's own body.
    const ok = DIRS.some(d => {
      if (body.includes(d)) return false
      const [di, dj, dk] = STEP[d]
      for (let a = i + di, b = j + dj, e = k + dk; a >= 0 && b >= 0 && e >= 0 && a < n && b < n && e < n; a += di, b += dj, e += dk) {
        if (at(g, a, b, e) === beam) return false
      }
      return true
    })
    if (!ok) out.push(idx(n, i, j, k))
  })
  return out
}

/** Thin necks: slices across a beam's length where it keeps less than a quarter of its section, with more of it beyond. */
export function weakSlices(g: Grid, beam: '0' | '1'): { slice: number; fraction: number }[] {
  const n = g.n
  const along: 'x' | 'y' = g.layout === 'cross' && beam === '1' ? 'y' : 'x'
  const count = (s0: number) => { let c = 0; for (let u = 0; u < n; u++) for (let k = 0; k < n; k++) if ((along === 'x' ? at(g, s0, u, k) : at(g, u, s0, k)) === beam) c++; return c }
  const counts = Array.from({ length: n }, (_, s0) => count(s0))
  const out: { slice: number; fraction: number }[] = []
  for (let s0 = 0; s0 < n; s0++) {
    const f = counts[s0] / (n * n)
    if (f >= 0.25) continue
    // Inline beams end in the grid: a slice is a neck only if there is more of the beam further from its body.
    const beyond = g.layout === 'cross' ? true : beam === '0' ? counts.slice(s0 + 1).some(c => c > 0) : counts.slice(0, s0).some(c => c > 0)
    if (beyond) out.push({ slice: s0, fraction: f })
  }
  return out
}

/** Cells whose wood runs only a cell long between the other beam's cells: short grain that snaps off. */
export function shortGrain(g: Grid, beam: '0' | '1'): number[] {
  const n = g.n
  const along: 'x' | 'y' = g.layout === 'cross' && beam === '1' ? 'y' : 'x'
  const out: number[] = []
  each(n, (i, j, k) => {
    if (at(g, i, j, k) !== beam) return
    const [a1, b1] = along === 'x' ? [i - 1, j] : [i, j - 1]
    const [a2, b2] = along === 'x' ? [i + 1, j] : [i, j + 1]
    const own = (a: number, b: number, onEdge: boolean) => (a < 0 || b < 0 || a >= n || b >= n ? onEdge : at(g, a, b, k) === beam)
    const bodyLow = attached(g.layout, beam).includes(along === 'x' ? 'x-' : 'y-'), bodyHigh = attached(g.layout, beam).includes(along === 'x' ? 'x+' : 'y+')
    if (!own(a1, b1, bodyLow) && !own(a2, b2, bodyHigh)) out.push(idx(n, i, j, k))
  })
  return out
}

/** Glue and friction: the faces where A meets B inside the grid, in square inches for a beam `size` across. */
export function contactArea(g: Grid, size: number): number {
  const n = g.n
  let faces = 0
  each(n, (i, j, k) => {
    const v = at(g, i, j, k)
    if (i + 1 < n && at(g, i + 1, j, k) !== v) faces++
    if (j + 1 < n && at(g, i, j + 1, k) !== v) faces++
    if (k + 1 < n && at(g, i, j, k + 1) !== v) faces++
  })
  return faces * (size / n) ** 2
}

export type Report = { slides: Dir[]; loose: { a: number[]; b: number[] }; unreachable: { a: number[]; b: number[] }; weak: { a: { slice: number; fraction: number }[]; b: { slice: number; fraction: number }[] }; short: { a: number[]; b: number[] }; area: number; ok: boolean }
export function report(g: Grid, size: number): Report {
  const r = {
    slides: slideDirs(g),
    loose: { a: loosePieces(g, '0').loose, b: loosePieces(g, '1').loose },
    unreachable: { a: unreachable(g, '0'), b: unreachable(g, '1') },
    weak: { a: weakSlices(g, '0'), b: weakSlices(g, '1') },
    short: { a: shortGrain(g, '0'), b: shortGrain(g, '1') },
    area: contactArea(g, size)
  }
  return { ...r, ok: r.slides.length > 0 && !r.loose.a.length && !r.loose.b.length && !r.unreachable.a.length && !r.unreachable.b.length }
}

/** Starting points. */
export function preset(name: 'lap' | 'tenon' | 'dovetail' | 'empty', layout: Grid['layout'], n: number): Grid {
  let g: Grid = { n, layout, cells: '0'.repeat(n ** 3) }
  const half = Math.floor(n / 2)
  each(n, (i, j, k) => {
    let b = false
    if (name === 'lap') b = layout === 'inline' ? k >= half : k >= half
    if (name === 'tenon') b = layout === 'inline' ? j >= Math.floor(n / 3) && j < n - Math.floor(n / 3) && k >= Math.floor(n / 3) && k < n - Math.floor(n / 3) : k >= half
    // The tail flares toward its tip (i = 0) and narrows toward B's body, so it can only drop in from above.
    if (name === 'dovetail') b = layout === 'inline' ? k >= half && Math.abs(j - (n - 1) / 2) <= (n / 4) * (1.5 - i / Math.max(1, n - 1)) : k >= half
    if (b) g = setCell(g, i, j, k, '1')
  })
  return g
}
