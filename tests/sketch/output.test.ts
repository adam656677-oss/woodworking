import { toDxf } from '../../src/sketch/dxf'
import { toSvg } from '../../src/sketch/svg'
import { tilePages } from '../../src/sketch/tiling'
import { apron } from './fixtures'

test('a 30" × 14" shape prints on 5 × 2 pages with 1/2" overlap, labelled A1…E2', () => {
  const t = tilePages({ minX: 0, minY: 0, maxX: 30, maxY: 14 })
  expect(t.map(x => x.id)).toEqual(['A1', 'B1', 'C1', 'D1', 'E1', 'A2', 'B2', 'C2', 'D2', 'E2'])
  expect(t[1].x - t[0].x).toBe(7)
  expect(t[0].y - t[5].y).toBe(9.5)
  const last = t[t.length - 1]
  expect(last.x + last.w).toBeGreaterThanOrEqual(30)
  expect(last.y).toBeLessThanOrEqual(0)
  expect(t[0].y + t[0].h).toBe(14)
})

test('a small shape fits on one page', () => {
  expect(tilePages({ minX: 2, minY: 3, maxX: 6, maxY: 7 }).map(x => x.id)).toEqual(['A1'])
})

test('DXF R12 in inches with the outline on its layer', () => {
  const d = toDxf(apron())
  expect(d).toContain('$INSUNITS\n70\n1')
  expect(d).toContain('AC1009')
  expect(d).toMatch(/0\nLINE\n8\nOUTLINE\n10\n0\n20\n0\n30\n0\n11\n0\n21\n4\n/)
  expect(d).toMatch(/0\nARC\n8\nOUTLINE\n10\n15\n20\n-55\.25\n30\n0\n40\n57\.25\n/)
  expect(d.trim().endsWith('EOF')).toBe(true)
})

test('SVG at true size with a real arc, the right way up', () => {
  const s = toSvg(apron())
  expect(s).toContain('width="30in"')
  expect(s).toContain('height="4in"')
  expect(s).toContain('viewBox="0 0 30 4"')
  expect(s).toMatch(/A 57\.25 57\.25 0 0 0 0 4"/)
  expect(s).toContain('<path d="M 0 4 L 0 0"/>')
})
