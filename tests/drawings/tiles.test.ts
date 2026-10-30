import { emptyProject } from '../../src/model/woods'
import { makeBoard, ORIENT } from '../../src/templates/place'
import { template, tiling, tileName, OVERLAP, TILE_MARGIN } from '../../src/drawings/tiles'
import type { Project } from '../../src/model/types'

test('tiling: pages across and down with 1/2" overlap', () => {
  expect(tiling(5, 8)).toMatchObject({ cols: 1, rows: 1 })
  expect(tiling(30, 10)).toMatchObject({ cols: 5, rows: 2 })
  expect(tileName(0, 0)).toBe('A1')
  expect(tileName(1, 2)).toBe('B3')
})

test('a 30" × 10" part: a cover with test squares, then A1…B5, every page full size', () => {
  const ply = emptyProject('T').woods.find(w => w.id === 'ply-3-4')!
  const b = makeBoard('Apron', ply, 10, 30, ORIENT.flatY, { x: 0, y: 0, z: 0 })
  const p: Project = { ...emptyProject('T'), boards: [b] }
  const t = template(p, b.id, 4)
  expect(t.pages.length).toBe(1 + 10)
  expect(t.pages[0]).toContain('width="1" height="1"')
  expect(t.pages[0]).toContain('5 cm')
  for (const pg of t.pages) expect(pg).toMatch(/^<svg[^>]*width="8.5in" height="11in"/)
  expect(t.pages[10]).toContain('page B5 of B5')
  // Neighbouring pages show the same registration mark at the same place on the paper, offset by one step.
  const marks = (svg: string) => [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="0.12"/g)].map(m => [+m[1], +m[2]])
  const a1 = marks(t.pages[1]), a2 = marks(t.pages[2])
  // Marks are drawn in drawing coordinates: A1 and A2 share the marks in their overlap.
  const shared = a1.filter(([x, y]) => a2.some(([u, v]) => Math.abs(u - x) < 1e-6 && Math.abs(v - y) < 1e-6))
  expect(shared.length).toBeGreaterThanOrEqual(3)
  // On paper each shared mark is inside the printed area of both pages (A2 is shifted left by one step).
  const step = 8.5 - 2 * TILE_MARGIN - OVERLAP
  for (const [x] of shared) {
    expect(x + TILE_MARGIN).toBeLessThan(8.5 - TILE_MARGIN)
    expect(x - step + TILE_MARGIN).toBeGreaterThan(TILE_MARGIN)
  }
  expect(OVERLAP).toBe(0.5)
  expect(TILE_MARGIN).toBeGreaterThan(0)
})

test('dump', async () => {
  if (!process.env.AA_SVG) return
  const { writeFileSync } = await import('node:fs')
  const ply = emptyProject('T').woods.find(w => w.id === 'ply-3-4')!
  const b = makeBoard('Apron', ply, 10, 30, ORIENT.flatY, { x: 0, y: 0, z: 0 })
  const t = template({ ...emptyProject('T'), boards: [b] }, b.id, 4)
  t.pages.forEach((s, i) => writeFileSync(`${process.env.AA_SVG}/tile-${i}.svg`, s))
})
