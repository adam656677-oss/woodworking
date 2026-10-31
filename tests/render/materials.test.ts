import { exportSize, finishLook, grainFrame, hexToRgb, LIGHTS, RAW, seedOf, sheenOf, speciesFor, swatch, varied, woodLook } from '../../src/render/materials'
import { pliesFor, woodUniforms } from '../../src/render/woodMaterial'
import { BUILTIN_WOODS } from '../../src/model/woods'
import { fromTemplate, TEMPLATES } from '../../src/finish/schedule'
import type { FinishSchedule, Wood } from '../../src/model/types'

const w = (o: Partial<Wood>): Wood => ({ id: 'w', name: 'W', kind: 'hardwood', species: '', thickness: 0.75, width: 6, length: 96, builtIn: false, ...o })
const lum = (c: [number, number, number]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

test('species → wood look: the Library colours, rings, pores', () => {
  expect(speciesFor('Pine')?.id).toBe('eastern-white-pine')
  expect(speciesFor('Oak plywood')?.id).toBe('red-oak')
  expect(speciesFor('Black walnut')?.id).toBe('black-walnut')
  const pine = woodLook(w({ kind: 'lumber', species: 'Pine' }))
  const oak = woodLook(w({ species: 'Red oak' }))
  const maple = woodLook(w({ species: 'Hard maple' }))
  const walnut = woodLook(w({ species: 'Walnut' }))
  // Softwood rings show strongly, oak has open pores, maple is quiet; walnut is dark.
  expect(pine.contrast).toBeGreaterThan(oak.contrast)
  expect(oak.pores).toBe(true)
  expect(maple.pores).toBe(false)
  expect(maple.contrast).toBeLessThan(oak.contrast)
  expect(lum(walnut.light)).toBeLessThan(lum(maple.light) * 0.6)
  // Latewood is darker than earlywood.
  for (const l of [pine, oak, maple, walnut]) expect(lum(l.dark)).toBeLessThan(lum(l.light))
  // Every built-in wood has a look: plywood with plies, MDF plain.
  for (const b of BUILTIN_WOODS) expect(woodLook(b).pattern).toBe(b.kind === 'sheet' ? (/mdf/i.test(b.species) ? 'mdf' : 'ply') : 'ring')
  expect(woodLook(w({ kind: 'sheet', species: 'Plywood' })).label).toMatch(/birch plywood/i)
  expect(woodLook(w({ species: 'Hardwood' })).pattern).toBe('ring')
})

test('each part gets its own grain and a slightly different colour', () => {
  const oak = woodLook(w({ species: 'Red oak' }))
  const a = varied(oak, 'board-a'), b = varied(oak, 'board-b')
  expect(a.light).not.toEqual(b.light)
  for (const v of [a, b]) for (let i = 0; i < 3; i++) expect(Math.abs(v.light[i] / oak.light[i] - 1)).toBeLessThan(0.08)
  expect(seedOf('x')).toBe(seedOf('x'))
  expect(seedOf('x')).toBeGreaterThanOrEqual(0)
  expect(seedOf('x')).toBeLessThan(1)
})

test('grain runs along the part, or across it when the part says so; the pith is below the face', () => {
  const g1 = grainFrame({ id: 'p', grain: 'length', width: 10, length: 30, thickness: 0.75 })
  expect(g1.along).toBe('y')
  expect(g1.pith[0]).toBeGreaterThanOrEqual(2)
  expect(g1.pith[0]).toBeLessThanOrEqual(8)
  expect(g1.pith[1]).toBeLessThan(-2.9)
  const g2 = grainFrame({ id: 'p', grain: 'width', width: 10, length: 30, thickness: 0.75 })
  expect(g2.along).toBe('x')
  expect(g2.across).toBe(30)
  expect(woodUniforms({ look: woodLook(undefined), finish: RAW, seed: 0.5, alongY: g2.along === 'y', pith: g2.pith, thickness: 0.75 }).uAlongY.value).toBe(0)
})

test('plies: odd, from the thickness', () => {
  expect(pliesFor(0.71875)).toBe(11)
  expect(pliesFor(0.21875)).toBe(3)
  expect(pliesFor(0.46875) % 2).toBe(1)
})

test('finish → colour and sheen', () => {
  expect(finishLook(undefined)).toEqual(RAW)
  // Gloss is smoother and glossier than satin, satin than matte.
  expect(sheenOf('Gloss').clearcoatRoughness).toBeLessThan(sheenOf('Satin').clearcoatRoughness)
  expect(sheenOf('Satin').clearcoat).toBeGreaterThan(sheenOf('Matte').clearcoat)
  expect(sheenOf('Semi-gloss').clearcoat).toBeLessThan(sheenOf('Gloss').clearcoat)
  // Every template gives a finished look (a topcoat or paint).
  for (const t of TEMPLATES) {
    const f = finishLook(fromTemplate(t.id))
    expect(f.clearcoat > 0 || f.paint).toBeTruthy()
  }
  const oil = finishLook({ name: 'Oil', steps: [{ id: '1', kind: 'topcoat', title: 'Wipe on oil', finishId: 'blo', coats: 3, dryHours: 24 }] })
  expect(oil.amber).toBe(1)
  const water: FinishSchedule = { name: 'WB', steps: [{ id: '1', kind: 'topcoat', title: 'Brush', finishId: 'water-poly', coats: 3, dryHours: 2, sheen: 'Gloss' }] }
  expect(finishLook(water).amber).toBe(0)
  expect(finishLook(water).clearcoat).toBe(1)
  // A walnut stain darkens and browns maple; paint covers it.
  const stained = finishLook({ name: 'S', steps: [{ id: '1', kind: 'colour', title: 'Stain', finishId: 'oil-stain', product: 'Minwax Dark Walnut', coats: 1, dryHours: 8 }, ...water.steps] })
  expect(stained.tint).toEqual(hexToRgb('#4e3526'))
  const maple = woodLook(w({ species: 'Hard maple' }))
  expect(lum(swatch(maple, stained))).toBeLessThan(lum(swatch(maple, RAW)) * 0.75)
  const painted = finishLook({ name: 'P', steps: [{ id: '1', kind: 'topcoat', title: 'Paint', finishId: 'latex-paint', product: 'Navy blue', coats: 2, dryHours: 4, sheen: 'Semi-gloss' }] })
  expect(painted.paint).toEqual(hexToRgb('#26344a'))
  expect(swatch(maple, painted)).toEqual(painted.paint)
})

test('light presets and picture sizes', () => {
  expect(Object.keys(LIGHTS)).toEqual(['studio', 'workshop', 'daylight'])
  expect(exportSize(1000, 600, 2)).toEqual({ width: 2000, height: 1200, ratio: 2 })
  // Never more than 4096 px on the long side.
  const big = exportSize(1600, 900, 4)
  expect(big.width).toBe(4096)
  expect(big.height).toBe(2304)
})
