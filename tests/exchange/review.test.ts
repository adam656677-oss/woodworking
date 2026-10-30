import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { partMeshes } from '../../src/exchange/meshes'
import { to3mf, toGlb, toStep } from '../../src/exchange/writers'
import { parseStep, read3mf, readObj, readStep, readStl } from '../../src/exchange/readers'

const shelf = applyTemplate(emptyProject('Bookshelf'), 'bookshelf', {})
const parts = partMeshes(shelf)

test('STEP faces are FACE_SURFACEs on PLANEs (what CAD programs read)', () => {
  const ents = [...parseStep(toStep(parts, 'x.step')).values()]
  expect(ents.some(e => e.type === 'FACE')).toBe(false)
  const faces = ents.filter(e => e.type === 'FACE_SURFACE')
  expect(faces.length).toBeGreaterThan(0)
  expect(ents.filter(e => e.type === 'PLANE').length).toBe(faces.length)
})

test('no triangle in 3MF or STEP repeats a corner', () => {
  const model = strFromU8(unzipSync(to3mf(parts))['3D/3dmodel.model'])
  for (const m of model.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)) expect(new Set([m[1], m[2], m[3]]).size).toBe(3)
  for (const e of parseStep(toStep(parts, 'x.step')).values()) if (e.type === 'POLY_LOOP') expect(new Set((e.args[1] as { ref: number }[]).map(r => r.ref)).size).toBe(3)
})

test('3MF: objects made of components (Fusion, Bambu), and the root model named in the package', () => {
  const tri = '<vertex x="0" y="0" z="0"/><vertex x="10" y="0" z="0"/><vertex x="0" y="10" z="0"/>'
  const sub = `<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>${tri}</vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources><build/></model>`
  const root = `<?xml version="1.0"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"><resources><object id="2" type="model"><components><component p:path="/3D/Objects/a.model" objectid="1" transform="1 0 0 0 1 0 0 0 1 100 0 0"/></components></object></resources><build><item objectid="2" transform="1 0 0 0 1 0 0 0 1 0 0 5"/></build></model>`
  const rels = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="r0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'
  const z = zipSync({ '3D/Objects/a.model': strToU8(sub), '_rels/.rels': strToU8(rels), '3D/3dmodel.model': strToU8(root) })
  const r = read3mf(z)
  expect(Array.from(r.positions.slice(0, 3))).toEqual([100, 0, 5])
  expect(r.positions.length).toBe(9)
})

test('STEP: a flat face with a round hole is kept (the circle tessellated); assemblies are flagged', () => {
  const L: string[] = []
  let n = 0
  const e = (s: string) => { n++; L.push(`#${n}=${s};`); return `#${n}` }
  const V = (x: number, y: number) => e(`VERTEX_POINT('',${e(`CARTESIAN_POINT('',(${x},${y},0.))`)})`)
  const c = [V(0, 0), V(10, 0), V(10, 10), V(0, 10)]
  const edges = c.map((v, i) => e(`ORIENTED_EDGE('',*,*,${e(`EDGE_CURVE('',${v},${c[(i + 1) % 4]},${e(`LINE('',$,$)`)},.T.)`)},.T.)`))
  const outer = e(`FACE_OUTER_BOUND('',${e(`EDGE_LOOP('',(${edges.join(',')}))`)},.T.)`)
  const hv = V(7, 5)
  const axis = e(`AXIS2_PLACEMENT_3D('',${e(`CARTESIAN_POINT('',(5.,5.,0.))`)},${e(`DIRECTION('',(0.,0.,1.))`)},${e(`DIRECTION('',(1.,0.,0.))`)})`)
  const circle = e(`CIRCLE('',${axis},2.)`)
  const hole = e(`FACE_BOUND('',${e(`EDGE_LOOP('',(${e(`ORIENTED_EDGE('',*,*,${e(`EDGE_CURVE('',${hv},${hv},${circle},.T.)`)},.T.)`)}))`)},.T.)`)
  e(`ADVANCED_FACE('',(${outer},${hole}),${e(`PLANE('',$)`)},.T.)`)
  e(`MAPPED_ITEM('',$,$)`)
  const r = readStep(`ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\n${L.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`)
  expect(r.skipped).toBeUndefined()
  // A square with a hole: area 100 − π·4.
  let area = 0
  const a = r.positions
  for (let i = 0; i < a.length; i += 9) area += Math.abs((a[i + 3] - a[i]) * (a[i + 7] - a[i + 1]) - (a[i + 6] - a[i]) * (a[i + 4] - a[i + 1])) / 2
  expect(area).toBeCloseTo(100 - Math.PI * 4, 0)
  expect(r.assembly).toBe(true)
})

test('a GLB of a part with many corners writes (no stack overflow); empty parts are left out', () => {
  const big = new Float32Array(160_000 * 9)
  for (let i = 0; i < big.length; i++) big[i] = (i * 7919) % 1000 / 10
  expect(() => toGlb([{ id: 'a', name: 'Big', path: [], woodId: 'x', positions: big }, { id: 'b', name: 'Empty', path: [], woodId: 'x', positions: new Float32Array() }], [])).not.toThrow()
})

test('readers: binary STL with trailing bytes, OBJ with tabs, 3MF microns', () => {
  const bin = new Uint8Array(84 + 50 + 7)
  const dv = new DataView(bin.buffer)
  dv.setUint32(80, 1, true)
  ;[0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((v, k) => dv.setFloat32(84 + 12 + k * 4, v, true))
  expect(readStl(bin).positions.length).toBe(9)
  expect(readObj('v\t0 0 0\nv\t1 0 0\nv\t0 1 0\nf\t1 2 3\n').positions.length).toBe(9)
  const z = zipSync({ '3D/3dmodel.model': strToU8('<model unit="micron"><resources><object id="1"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="1000" y="0" z="0"/><vertex x="0" y="1000" z="0"/></vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources><build><item objectid="1"/></build></model>') })
  const r = read3mf(z)
  expect(r.unit).toBe('mm')
  expect(Math.max(...r.positions)).toBe(1)
})
