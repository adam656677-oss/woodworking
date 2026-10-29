import { cutList } from '../../src/model/cutlist'
import { worldBox } from '../../src/model/geometry'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'
import { setSize } from '../../src/formulas/ops'
import { recalc } from '../../src/formulas/recalc'
import { applyTemplate, unlock, type ParamValue } from '../../src/templates'

const ok = (r: Project | { error: string }): Project => { if ('error' in r) throw new Error(r.error); return r }
const live = (id: string, params: Record<string, ParamValue>) => applyTemplate(emptyProject('T'), id, params)
const rows = (p: Project) => cutList(p).rows

function sameBoards(a: Project, b: Project) {
  expect(a.boards.length).toBe(b.boards.length)
  a.boards.forEach((x, i) => {
    const y = b.boards[i]
    expect([x.name, x.width, x.length]).toEqual([y.name, y.width, y.length])
    const A = worldBox(x), B = worldBox(y)
    for (const k of ['x', 'y', 'z'] as const) {
      expect(Math.abs(A.min[k] - B.min[k])).toBeLessThanOrEqual(1 / 64 + 1e-9)
      expect(Math.abs(A.max[k] - B.max[k])).toBeLessThanOrEqual(1 / 64 + 1e-9)
    }
  })
}

const CASES: [string, Record<string, ParamValue>[]][] = [
  ['box', [{}, { W: 18, D: 10, H: 4, corners: 'rabbet' }, { W: 9, D: 9, H: 9, lid: true }]],
  ['bookshelf', [{}, { W: 24, H: 60, D: 12, shelves: 4, back: false }, { W: 36, H: 30, shelves: 1 }]],
  ['birdhouse', [{}, { floorW: 6, floorD: 4, height: 10, overhang: 2 }, { floorW: 4, floorD: 7, height: 6, overhang: 0, hole: 1.5 }]]
]

test.each(CASES)('unlocking a %s keeps every part and the cut list exactly', (id, settings) => {
  for (const s of settings) {
    const p = live(id, s)
    const u = unlock(p)
    expect(u.template).toBeUndefined()
    expect(recalc(u).errors).toEqual([])
    sameBoards(u, p)
    expect(rows(u)).toEqual(rows(p))
  }
})

const RESIZE: [string, Record<string, ParamValue>, Record<string, number>, Record<string, ParamValue>][] = [
  ['box', { corners: 'rabbet' }, { W: 16, H: 5 }, { corners: 'rabbet', W: 16, H: 5 }],
  ['box', {}, { D: 11 }, { D: 11 }],
  ['bookshelf', {}, { H: 48 }, { H: 48 }],
  ['bookshelf', {}, { W: 40, D: 12, Shelves: 5 }, { W: 40, D: 12, shelves: 5 }],
  ['bookshelf', { back: false, shelves: 2 }, { Shelves: 1 }, { back: false, shelves: 1 }],
  ['birdhouse', {}, { FloorW: 7, Height: 11, Overhang: 2 }, { floorW: 7, height: 11, overhang: 2 }]
]

test.each(RESIZE)('after unlocking a %s, changing its sizes matches a fresh template', (id, start, change, fresh) => {
  let u = unlock(live(id, start))
  for (const [name, v] of Object.entries(change)) u = ok(setSize(u, name, String(v)))
  const r = recalc(u)
  expect(r.errors).toEqual([])
  expect(rows(r.project)).toEqual(rows(live(id, fresh)))
})

test('unlocked formulas are stored without their leading =', () => {
  for (const [id, params] of [['bookshelf', {}], ['box', {}], ['birdhouse', {}]] as const) {
    const p = unlock(live(id, params))
    const all = [...p.boards.flatMap(b => Object.values(b.formulas ?? {})), ...p.joints.flatMap(j => Object.values(j.formulas ?? {})), ...(p.sizes ?? []).map(s => s.expr)]
    expect(all.length).toBeGreaterThan(0)
    for (const f of all) expect(f.startsWith('=')).toBe(false)
  }
})
